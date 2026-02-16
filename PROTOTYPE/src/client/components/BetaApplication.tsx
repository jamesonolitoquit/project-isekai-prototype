/**
 * M38 Task 1: The Beta Shell
 * 
 * Unified interface integrating all M35-M37 components:
 * - M35: Epoch-aware soundscapes, narrative intervention (Seer/Director)
 * - M36: Multiplayer consensus, latency tracking, semi-persistent state
 * - M37: Faction autonomous turns, macro events, P2P inventory trading, timeline gallery
 * 
 * Responsive layout with persistent HUD, modal dialogs, and tab-based panel system.
 * Production-ready for Beta launch with real-time state synchronization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import type { TradeState } from '../../engine/multiplayerEngine';
import BetaGlobalHeader from './BetaGlobalHeader';
import ErrorBoundary from './ErrorBoundary';
import CoDmDashboard from './CoDmDashboard';
import TutorialOverlayComponent from './TutorialOverlay';
import {
  initializeTutorialState,
  detectMilestones,
  updateTutorialState,
  getNextTutorialOverlay,
  dismissTutorialOverlay,
  type TutorialState
} from '../../engine/tutorialEngine';
import { themeManager } from '../../devTools/epochThemeManager';
import { getEpochSyncEngine } from '../../engine/epochSyncEngine';
import '../../styles/epoch-theme.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MainTab = 'world' | 'social' | 'arcane' | 'records';

export interface BetaApplicationProps {
  initialState: WorldState;
  controller: any;
  isMultiplayer?: boolean;
  clientId?: string;
  showDevTools?: boolean;
}

// ============================================================================
// MAIN BETA APPLICATION COMPONENT
// ============================================================================

export const BetaApplication: React.FC<BetaApplicationProps> = ({
  initialState,
  controller,
  isMultiplayer = false,
  clientId = 'client_0',
  showDevTools = false
}) => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================

  const [state, setState] = useState<WorldState>(initialState);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('world');
  const [isDirector, setIsDirector] = useState(false);
  const [tutorialState, setTutorialState] = useState<TutorialState>(initializeTutorialState());
  const [currentTutorialOverlay, setCurrentTutorialOverlay] = useState(getNextTutorialOverlay(tutorialState));

  // Removed unused subTab state - planned for future enhancement

  // Removed unused DiceAltar state - will integrate modal system in Task 2
  const [showInventory, setShowInventory] = useState(false);
  const [showTradeUI, setShowTradeUI] = useState(false);
  const [activeTrade, setActiveTrade] = useState<TradeState | null>(null);
  const [showCraftingModal, setShowCraftingModal] = useState(false);
  // Faction AI diagnostics (M37)
  const [factionDiagnostics] = useState<any>(null);

  // Macro Event diagnostics (M37)
  const [macroEventDiagnostics] = useState<any>(null);

  // Multiplayer info (M36)
  const [consensusDiagnostics] = useState<any>(null);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    if (!controller) return;

    // Subscribe to state updates
    let unsubscribe: (() => void) | null = null;

    if (controller.subscribe) {
      unsubscribe = controller.subscribe((newState: WorldState) => {
        setState(newState);
      });
    } else {
      // Fallback: poll for state
      const pollId = setInterval(() => {
        try {
          const latest = controller.getState?.();
          if (latest) setState(latest);
        } catch (error: unknown) {
          // Silently fail on poll - prevent console spam from unavailable controller
          if (error instanceof Error && !error.message.includes('getState')) {
            console.debug('State poll error:', error);
          }
        }
      }, 200);

      return () => clearInterval(pollId);
    }

    if (controller.start) {
      controller.start();
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (controller.stop) controller.stop();
    };
  }, [controller]);

  // M40 Task 4: Keyboard navigation (1-4 for tab switching, Shift+D for Director Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return; // Don't interfere with system shortcuts

      // Director Mode toggle: Shift+D
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDirector(prev => !prev);
        return;
      }

      const tabMap: Record<string, MainTab> = {
        '1': 'world',
        '2': 'social',
        '3': 'arcane',
        '4': 'records',
      };

      if (tabMap[e.key]) {
        e.preventDefault();
        setActiveMainTab(tabMap[e.key]);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, []);

  // M41 Task 2: Tutorial milestone detection
  useEffect(() => {
    if (!state) return;

    // Detect newly achieved milestones
    const detected = detectMilestones(state, tutorialState);
    if (detected.length > 0) {
      const updated = updateTutorialState(tutorialState, detected, state.tick || 0);
      setTutorialState(updated);
      setCurrentTutorialOverlay(getNextTutorialOverlay(updated));
    }
  }, [state?.tick]); // Re-run when tick changes (new event occurred)

  // M41 Task 5: Epoch-based theme morphing
  useEffect(() => {
    if (!state?.epochId) return;

    // Apply theme based on current epoch (1, 2, or 3)
    const epoch = state.epochId as 1 | 2 | 3;
    if (epoch >= 1 && epoch <= 3) {
      themeManager.applyTheme(epoch, true);
    }
  }, [state?.epochId]); // Re-run whenever epoch changes

  // M42 Task 1: Subscribe to remote epoch shifts from P2P network
  useEffect(() => {
    const epochSyncEngine = getEpochSyncEngine();

    // Subscribe to epoch shift events (both local and remote)
    const unsubscribe = epochSyncEngine.subscribeToEpochShifts((event) => {
      try {
        // Apply theme morphing on remote shift
        if (event.targetEpoch >= 1 && event.targetEpoch <= 3) {
          console.log(`[BetaApp] Applying epoch shift to ${event.targetEpoch} from ${event.source}`);
          themeManager.applyTheme(event.targetEpoch, true);
        }

        // Record sync timing for telemetry
        const syncLatency = Date.now() - event.timestamp;
        if (syncLatency > 100) {
          console.warn(`[BetaApp] Slow epoch sync: ${syncLatency}ms latency (target: <100ms)`);
        }
      } catch (error) {
        console.error('[BetaApp] Error processing epoch shift:', error);
      }
    });

    return () => unsubscribe();
  }, []); // Effect runs once on mount

  // =========================================================================
  // ACTION HANDLERS
  // =========================================================================

  // M41 Task 3: Export full debug state (telemetry)
  const exportFullDebugState = useCallback(() => {
    const debugState = {
      timestamp: new Date().toISOString(),
      tick: state.tick,
      worldState: {
        id: state.id,
        epoch: state.epochId,
        player: state.player ? {
          name: state.player.name,
          level: state.player.level,
          hp: state.player.hp,
          maxHp: state.player.maxHp,
          location: state.player.location,
          xp: state.player.xp,
          gold: state.player.gold,
          temporalDebt: state.player.temporalDebt,
          soulStrain: state.player.soulStrain,
          inventory_count: state.player.inventory?.length || 0
        } : null,
        npcs_count: state.npcs?.length || 0,
        quests_count: state.quests?.length || 0,
        activeEvents_count: state.activeEvents?.length || 0
      },
      tutorialState: tutorialState,
      environment: {
        hour: state.hour,
        day: state.day,
        season: state.season,
        weather: state.weather,
        dayPhase: state.dayPhase
      }
    };

    const json = JSON.stringify(debugState, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug_state_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [state, tutorialState]);

  const performAction = useCallback((actionRequest: any) => {
    if (!controller) return;

    const action = {
      ...actionRequest,
      worldId: state.id,
      playerId: state.player?.id || 'player_0',
      clientId
    };

    controller.performAction(action);
  }, [controller, state.id, state.player?.id, clientId]);

  const handleTradeInitiate = useCallback((responderId: string, initiatorItems: any[], responderItems: any[]) => {
    performAction({
      type: 'INITIATE_TRADE',
      payload: {
        responderId,
        initiatorItems,
        responderItems
      }
    });
    setShowTradeUI(true);
  }, [performAction]);

  const handleTradeConfirm = useCallback(() => {
    performAction({
      type: 'CONFIRM_TRADE',
      payload: { tradeId: activeTrade?.tradeId }
    });
  }, [activeTrade?.tradeId, performAction]);

  const handleTradeCancel = useCallback(() => {
    performAction({
      type: 'CANCEL_TRADE',
      payload: { tradeId: activeTrade?.tradeId }
    });
    setActiveTrade(null);
    setShowTradeUI(false);
  }, [activeTrade?.tradeId, performAction]);

  // =========================================================================
  // RENDER: MAIN LAYOUT
  // =========================================================================

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#0d0d1a',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(79, 39, 131, 0.2), transparent)',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* ===== M39 TASK 2: BETA GLOBAL HEADER (Real-time Telemetry) ===== */}
      <BetaGlobalHeader 
        state={state} 
        consensusDiagnostics={consensusDiagnostics}
        macroEventDiagnostics={macroEventDiagnostics}
        onExportDebug={exportFullDebugState}
      />

      {/* ===== CHARACTER CREATION OVERLAY ===== */}
      {state?.needsCharacterCreation && (
        <CharacterCreationOverlay
          onCharacterCreated={() => {
            // Character creation handled by controller
          }}
          initialLocation={state?.player?.location}
        />
      )}

      {/* ===== MAIN CONTENT AREA ===== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT SIDEBAR: Quick Access Panels */}
        <BetaSidebar
          state={state}
          onShowInventory={() => setShowInventory(true)}
          onShowTrade={() => setShowTradeUI(true)}
          onShowCrafting={() => setShowCraftingModal(true)}
          isDirector={isDirector}
          onToggleDirector={() => setIsDirector(prev => !prev)}
          onExportDebug={exportFullDebugState}
        />

        {/* CENTER: Main Tab Interface */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab Navigation */}
          <BetaTabNavigation
            activeTab={activeMainTab}
            onTabChange={setActiveMainTab}
          />

          {/* Tab Content - M40 Task 4: Add role="tabpanel" for accessibility */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px', borderTop: '1px solid #333' }} role="tabpanel">
            {/* M40 Task 3: Wrap each tab panel in ErrorBoundary */}
            {activeMainTab === 'world' && (
              <div aria-labelledby="world-tab">
                <ErrorBoundary tabName="World">
                  <BetaWorldPanel
                    state={state}
                    onPerformAction={performAction}
                    factionDiagnostics={factionDiagnostics}
                    macroEventDiagnostics={macroEventDiagnostics}
                  />
                </ErrorBoundary>
              </div>
            )}

            {activeMainTab === 'social' && (
              <div aria-labelledby="social-tab">
                <ErrorBoundary tabName="Social">
                  <BetaSocialPanel
                    state={state}
                    onInitiateTrade={handleTradeInitiate}
                    factionDiagnostics={factionDiagnostics}
                  />
                </ErrorBoundary>
              </div>
            )}

            {activeMainTab === 'arcane' && (
              <div aria-labelledby="arcane-tab">
                <ErrorBoundary tabName="Arcane">
                  <BetaArcanePanel
                    state={state}
                    onPerformAction={performAction}
                  />
                </ErrorBoundary>
              </div>
            )}

            {activeMainTab === 'records' && (
              <div aria-labelledby="records-tab">
                <ErrorBoundary tabName="Records">
                  <BetaRecordsPanel
                    state={state}
                  />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR: Real-time Diagnostics (Dev Mode) */}
        {showDevTools && (
          <BetaDiagnosticsPanel
            factionDiagnostics={factionDiagnostics}
            macroEventDiagnostics={macroEventDiagnostics}
            consensusDiagnostics={consensusDiagnostics}
          />
        )}
      </div>

      {/* ===== MODAL DIALOGS ===== */}
      {showInventory && (
        <BetaInventoryModal state={state} onClose={() => setShowInventory(false)} />
      )}

      {showTradeUI && activeTrade && (
        <BetaTradeModal
          trade={activeTrade}
          onConfirm={handleTradeConfirm}
          onCancel={handleTradeCancel}
        />
      )}

      {showCraftingModal && (
        <BetaCraftingModal
          state={state}
          onCraft={(recipeId) => {
            performAction({ type: 'CRAFT_ITEM', payload: { recipeId } });
            setShowCraftingModal(false);
          }}
          onClose={() => setShowCraftingModal(false)}
        />
      )}

      {/* M41 Task 1: Director Mode - CoDmDashboard Overlay */}
      {isDirector && (
        <dialog
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            border: 'none',
            margin: 0
          }}
          open={isDirector}
        >
          <div
            style={{
              backgroundColor: 'rgba(13, 13, 26, 0.95)',
              border: '2px solid #c084fc',
              borderRadius: '8px',
              width: '90%',
              height: '90%',
              overflow: 'auto',
              boxShadow: '0 0 20px rgba(192, 132, 252, 0.3)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setIsDirector(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#c084fc',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '14px',
                zIndex: 10000,
                color: '#000'
              }}
              aria-label="Close Director Mode"
            >
              Close (Shift+D)
            </button>
            <div style={{ paddingTop: '40px' }}>
              <CoDmDashboard worldState={state} />
            </div>
          </div>
        </dialog>
      )}

      {/* M41 Task 2: Tutorial Overlay */}
      {currentTutorialOverlay && (
        <TutorialOverlayComponent
          overlay={currentTutorialOverlay}
          onDismiss={() => {
            setCurrentTutorialOverlay(undefined);
            setTutorialState(
              dismissTutorialOverlay(tutorialState, currentTutorialOverlay.milestoneId)
            );
          }}
          autoHideDelay={8000}
        />
      )}
    </div>
  );
};

// ============================================================================
// BETA SIDEBAR
// ============================================================================

interface BetaSidebarProps {
  state: WorldState;
  onShowInventory: () => void;
  onShowTrade: () => void;
  onShowCrafting: () => void;
  isDirector: boolean;
  onToggleDirector: () => void;
  onExportDebug: () => void;
}

const BetaSidebar: React.FC<BetaSidebarProps> = ({
  state,
  onShowInventory,
  onShowTrade,
  onShowCrafting,
  isDirector,
  onToggleDirector,
  onExportDebug
}) => {
  return (
    <div
      style={{
        width: '200px',
        borderRight: '1px solid #333',
        backgroundColor: 'rgba(13, 13, 26, 0.8)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <button
        onClick={onShowInventory}
        style={{
          padding: '8px 12px',
          backgroundColor: '#493d4a',
          border: '1px solid #666',
          color: '#c084fc',
          cursor: 'pointer',
          fontSize: '11px',
          borderRadius: '4px'
        }}
      >
        🎒 Inventory ({state.player?.inventory?.length || 0})
      </button>

      <button
        onClick={onShowTrade}
        style={{
          padding: '8px 12px',
          backgroundColor: '#493d4a',
          border: '1px solid #666',
          color: '#c084fc',
          cursor: 'pointer',
          fontSize: '11px',
          borderRadius: '4px'
        }}
      >
        💱 Trade
      </button>

      <button
        onClick={onShowCrafting}
        style={{
          padding: '8px 12px',
          backgroundColor: '#493d4a',
          border: '1px solid #666',
          color: '#c084fc',
          cursor: 'pointer',
          fontSize: '11px',
          borderRadius: '4px'
        }}
      >
        🔨 Craft
      </button>

      <div
        style={{
          marginTop: '20px',
          paddingTop: '12px',
          borderTop: '1px solid #333',
          fontSize: '10px',
          color: '#666'
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#999' }}>Status</div>
        <div>
          <strong style={{ color: '#a78bfa' }}>Level:</strong> {state.player?.level || 1}
        </div>
        <div>
          <strong style={{ color: '#a78bfa' }}>XP:</strong> {state.player?.xp || 0}
        </div>
        <div>
          <strong style={{ color: '#a78bfa' }}>Location:</strong> {state.player?.location || 'Unknown'}
        </div>
      </div>

      {/* M41 Task 3: Director Mode Toggle */}
      <button
        onClick={onToggleDirector}
        style={{
          marginTop: 'auto',
          padding: '10px 12px',
          backgroundColor: isDirector ? '#6b21a8' : '#493d4a',
          border: isDirector ? '2px solid #c084fc' : '1px solid #666',
          color: isDirector ? '#e9d5ff' : '#c084fc',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '4px',
          transition: 'all 0.2s ease'
        }}
        title="Toggle Director Mode (Shift+D)"
      >
        {isDirector ? '👁️ Director: ON' : '👁️ Director: OFF'}
      </button>

      {/* M41 Task 3: Debug Export Button */}
      <button
        onClick={onExportDebug}
        style={{
          padding: '8px 12px',
          backgroundColor: '#4a3e2a',
          border: '1px solid #666',
          color: '#f59e0b',
          cursor: 'pointer',
          fontSize: '11px',
          borderRadius: '4px',
          transition: 'all 0.2s ease'
        }}
        title="Export debug state as JSON"
      >
        🐜 Export Debug
      </button>
    </div>
  );
};

// ============================================================================
// BETA TAB NAVIGATION
// ============================================================================

interface BetaTabNavigationProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

const BetaTabNavigation: React.FC<BetaTabNavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'world', label: '🌍 World (1)', ariaLabel: 'World tab - Press 1 to activate' },
    { id: 'social', label: '👥 Social (2)', ariaLabel: 'Social tab - Press 2 to activate' },
    { id: 'arcane', label: '✨ Arcane (3)', ariaLabel: 'Arcane tab - Press 3 to activate' },
    { id: 'records', label: '📖 Records (4)', ariaLabel: 'Records tab - Press 4 to activate' }
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: 'rgba(13, 13, 26, 0.9)',
        borderBottom: '1px solid #333'
      }}
      role="tablist"
      aria-label="Main navigation tabs"
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          id={`${tab.id}-tab`}
          onClick={() => onTabChange(tab.id as MainTab)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-label={tab.ariaLabel}
          tabIndex={activeTab === tab.id ? 0 : -1}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === tab.id ? '#4f2783' : 'transparent',
            border: `1px solid ${activeTab === tab.id ? '#c084fc' : '#333'}`,
            color: activeTab === tab.id ? '#c084fc' : '#999',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            transition: 'all 0.2s'
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// BETA PANEL COMPONENTS
// ============================================================================

interface BetaWorldPanelProps {
  state: WorldState;
  onPerformAction: (action: any) => void;
  factionDiagnostics: any;
  macroEventDiagnostics: any;
}

const BetaWorldPanel: React.FC<BetaWorldPanelProps> = ({
  state,
  onPerformAction,
  factionDiagnostics,
  macroEventDiagnostics
}) => {
  return (
    <div>
      <h2 style={{ color: '#c084fc', marginBottom: '16px' }}>🌍 World Overview</h2>

      {/* Macro Events Panel */}
      {macroEventDiagnostics && (
        <div
          style={{
            backgroundColor: 'rgba(79, 39, 131, 0.2)',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #4f2783'
          }}
        >
          <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
            ⚠️ Active Macro Events
          </h3>
          <div style={{ fontSize: '11px', color: '#e0e0e0' }}>
            <div>Active Events: {macroEventDiagnostics.activeCount || 0}</div>
            <div>Avg Severity: {(macroEventDiagnostics.avgSeverity || 0).toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* Location Info */}
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      >
        <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
          📍 Current Location
        </h3>
        <div style={{ fontSize: '12px' }}>
          <div>Location: <span style={{ color: '#c084fc' }}>{state.player?.location}</span></div>
          <div>NPCs: <span style={{ color: '#c084fc' }}>{(state.npcs || []).length}</span></div>
          <div>Time: <span style={{ color: '#c084fc' }}>{state.hour}:00</span></div>
        </div>
      </div>
    </div>
  );
};

interface BetaSocialPanelProps {
  state: WorldState;
  onInitiateTrade: (responderId: string, initiatorItems: any[], responderItems: any[]) => void;
  factionDiagnostics: any;
}

const BetaSocialPanel: React.FC<BetaSocialPanelProps> = ({
  state,
  onInitiateTrade,
  factionDiagnostics
}) => {
  return (
    <div>
      <h2 style={{ color: '#c084fc', marginBottom: '16px' }}>👥 Social Network</h2>

      {/* Faction Overview */}
      {factionDiagnostics && (
        <div
          style={{
            backgroundColor: 'rgba(79, 39, 131, 0.2)',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #4f2783'
          }}
        >
          <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
            👑 Faction Dynamics
          </h3>
          <div style={{ fontSize: '11px', color: '#e0e0e0', lineHeight: '1.6' }}>
            <div>Active Factions: {factionDiagnostics.factionCount || 0}</div>
            <div>Avg Power: {(factionDiagnostics.avgPower || 0).toFixed(0)}</div>
            <div>Active Conflicts: {factionDiagnostics.conflictCount || 0}</div>
          </div>
        </div>
      )}

      {/* P2P Trading Section */}
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      >
        <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
          💱 Peer-to-Peer Trading
        </h3>
        <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
          Initiate trades with other players. Complete trades are committed atomically to prevent item duplication.
        </p>
      </div>
    </div>
  );
};

interface BetaArcanePanelProps {
  state: WorldState;
  onPerformAction: (action: any) => void;
}

const BetaArcanePanel: React.FC<BetaArcanePanelProps> = ({ state, onPerformAction }) => {
  return (
    <div>
      <h2 style={{ color: '#c084fc', marginBottom: '16px' }}>✨ Arcane Knowledge</h2>
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #333'
        }}
      >
        <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
          🔮 Prophecy & Paradox
        </h3>
        <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
          Paradox Level: {(state as any).paradoxLevel || 0}%
        </p>
        <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>
          Temporal Paradoxes: {(state as any).temporalParadoxes?.length || 0}
        </p>
      </div>
    </div>
  );
};

interface BetaRecordsPanelProps {
  state: WorldState;
}

const BetaRecordsPanel: React.FC<BetaRecordsPanelProps> = ({ state }) => {
  const [recordsTab, setRecordsTab] = React.useState<'chronicles' | 'deeds' | 'whispers'>('chronicles');

  return (
    <div>
      <h2 style={{ color: '#c084fc', marginBottom: '16px' }}>📖 Chronicles & Records</h2>

      {/* Records Tab Navigation - M40 Task 4: Add ARIA labels */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }} role="tablist" aria-label="Records tabs">
        {(['chronicles', 'deeds', 'whispers'] as const).map(tab => {
          const getAriaLabel = (tab: 'chronicles' | 'deeds' | 'whispers') => {
            if (tab === 'chronicles')
              return 'Chronicles tab - Timeline showing world history';
            if (tab === 'deeds')
              return 'Deeds tab - Your legendary actions';
            return 'Whispers tab - Narrative interventions from the Director';
          };
          
          return (
            <button
              key={tab}
              id={`${tab}-tab`}
              onClick={() => setRecordsTab(tab)}
              role="tab"
              aria-selected={recordsTab === tab}
              aria-label={getAriaLabel(tab)}
              tabIndex={recordsTab === tab ? 0 : -1}
              style={{
                padding: '8px 16px',
                backgroundColor: recordsTab === tab ? '#4f2783' : 'transparent',
                border: `1px solid ${recordsTab === tab ? '#c084fc' : '#333'}`,
                color: recordsTab === tab ? '#c084fc' : '#999',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'monospace',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'chronicles' && '🗺️ Chronicles'}
              {tab === 'deeds' && '⚔️ Deeds'}
              {tab === 'whispers' && '🔮 Whispers'}
            </button>
          );
        })}
      </div>

      {/* Chronicles Tab - M40 Task 4: Add role="tabpanel" for accessibility */}
      {recordsTab === 'chronicles' && (
        <div
          role="tabpanel"
          aria-labelledby="chronicles-tab"
          style={{
            backgroundColor: 'rgba(79, 39, 131, 0.2)',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #4f2783'
          }}
        >
          <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
            🗺️ Chronicle Gallery
          </h3>
          <p style={{ fontSize: '11px', color: '#e0e0e0', margin: 0 }}>
            Interactive timeline showing world history, major deeds, mutations, and epoch-defining events.
          </p>
        </div>
      )}

      {/* Deeds Tab - M40 Task 4: Add role="tabpanel" for accessibility */}
      {recordsTab === 'deeds' && (
        <div
          role="tabpanel"
          aria-labelledby="deeds-tab"
          style={{
            backgroundColor: 'rgba(79, 39, 131, 0.1)',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #333'
          }}
        >
          <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 8px 0' }}>
            ⚔️ Recent Deeds
          </h3>
          <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>
            Your legendary actions recorded across the epochs.
          </p>
        </div>
      )}

      {/* M39 Task 4: Whispers Sub-Pane - M40 Task 4: Add role="tabpanel" for accessibility */}
      {recordsTab === 'whispers' && (
        <div
          role="tabpanel"
          aria-labelledby="whispers-tab"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #8b5cf6'
          }}
        >
          <h3 style={{ color: '#c084fc', fontSize: '13px', margin: '0 0 12px 0' }}>
            🔮 Seer's Whispers
          </h3>
          <p style={{ fontSize: '10px', color: '#a78bfa', marginBottom: '12px', fontStyle: 'italic' }}>
            Narrative interventions from the realm's Director
          </p>

          {/* Whispers Log */}
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: 'rgba(13, 13, 26, 0.5)',
              padding: '8px',
              borderRadius: '3px',
              border: '1px solid #4f2783'
            }}
          >
            {(state as any)?.narrativeInterventions && (state as any).narrativeInterventions.length > 0 ? (
              (state as any).narrativeInterventions.map((whisper: any, idx: number) => (
                <div
                  key={whisper.id || idx}
                  style={{
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #333',
                    fontSize: '10px'
                  }}
                >
                  <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '4px' }}>
                    {whisper.timestamp ? new Date(whisper.timestamp).toLocaleTimeString() : 'Timeless'}
                  </div>
                  <div style={{ color: '#a78bfa' }}>
                    "{whisper.narrative || whisper.message || 'A mysterious whisper...'}"
                  </div>
                  {whisper.type && (
                    <div style={{ color: '#888', fontSize: '9px', marginTop: '4px' }}>
                      Type: {whisper.type}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>
                No whispers yet. The Director remains silent...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DIAGNOSTIC PANELS
// ============================================================================

interface BetaDiagnosticsPanelProps {
  factionDiagnostics: any;
  macroEventDiagnostics: any;
  consensusDiagnostics: any;
}

const BetaDiagnosticsPanel: React.FC<BetaDiagnosticsPanelProps> = ({
  factionDiagnostics,
  macroEventDiagnostics,
  consensusDiagnostics
}) => {
  return (
    <div
      style={{
        width: '250px',
        borderLeft: '1px solid #333',
        backgroundColor: 'rgba(13, 13, 26, 0.8)',
        padding: '12px',
        overflow: 'auto',
        fontSize: '10px'
      }}
    >
      <h4 style={{ color: '#c084fc', margin: '0 0 8px 0' }}>⚙️ Diagnostics</h4>

      {/* Faction Diagnostics */}
      {factionDiagnostics && (
        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(79, 39, 131, 0.2)', borderRadius: '3px' }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>👑 Factions</div>
          <div style={{ color: '#999' }}>Active: {factionDiagnostics.factionCount || 0}</div>
          <div style={{ color: '#999' }}>Power: {(factionDiagnostics.avgPower || 0).toFixed(0)}</div>
        </div>
      )}

      {/* Macro Event Diagnostics */}
      {macroEventDiagnostics && (
        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(79, 39, 131, 0.2)', borderRadius: '3px' }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>⚠️ Macro Events</div>
          <div style={{ color: '#999' }}>Active: {macroEventDiagnostics.activeCount || 0}</div>
          <div style={{ color: '#999' }}>Severity: {(macroEventDiagnostics.avgSeverity || 0).toFixed(0)}%</div>
        </div>
      )}

      {/* Consensus Diagnostics */}
      {consensusDiagnostics && (
        <div style={{ padding: '8px', backgroundColor: 'rgba(79, 39, 131, 0.2)', borderRadius: '3px' }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold' }}>🔗 Consensus</div>
          <div style={{ color: '#999' }}>Proposals: {consensusDiagnostics.activeProposals || 0}</div>
          <div style={{ color: '#999' }}>Latency: {(consensusDiagnostics.averageLatency || 0).toFixed(0)}ms</div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MODAL COMPONENTS
// ============================================================================

interface BetaInventoryModalProps {
  state: WorldState;
  onClose: () => void;
}

const BetaInventoryModal: React.FC<BetaInventoryModalProps> = ({ state, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '2px solid #4f2783',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          maxHeight: '600px',
          overflow: 'auto'
        }}
      >
        <h2 style={{ color: '#c084fc', marginTop: 0 }}>🎒 Inventory</h2>
        <div style={{ fontSize: '12px', color: '#e0e0e0', lineHeight: '1.8' }}>
          {!state.player?.inventory || state.player.inventory.length === 0 ? (
            <p>Your inventory is empty.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {state.player.inventory.map((item: any) => (
                <li key={`${item.itemId}_${item.location || 'inv'}`}>
                  {item.itemId} x{item.quantity || 1}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#4f2783',
            border: '1px solid #c084fc',
            color: '#c084fc',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

interface BetaTradeModalProps {
  trade: TradeState;
  onConfirm: () => void;
  onCancel: () => void;
}

const BetaTradeModal: React.FC<BetaTradeModalProps> = ({ trade, onConfirm, onCancel }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '2px solid #4f2783',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px'
        }}
      >
        <h2 style={{ color: '#c084fc', marginTop: 0 }}>💱 Trade Proposal</h2>
        <div style={{ fontSize: '12px', color: '#e0e0e0', marginBottom: '16px' }}>
          <div>Status: <span style={{ color: '#a78bfa' }}>{trade.stage}</span></div>
          <div>Your Offer: {trade.initiatorItems.map((i: any) => `${i.itemId} x${i.quantity}`).join(', ')}</div>
          <div>Their Offer: {trade.responderItems.map((i: any) => `${i.itemId} x${i.quantity}`).join(', ')}</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00ff00',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Confirm Trade
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6b6b',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface BetaCraftingModalProps {
  state: WorldState;
  onCraft: (recipeId: string) => void;
  onClose: () => void;
}

const BetaCraftingModal: React.FC<BetaCraftingModalProps> = ({ state, onCraft, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 500
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '2px solid #4f2783',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px'
        }}
      >
        <h2 style={{ color: '#c084fc', marginTop: 0 }}>🔨 Crafting</h2>
        <p style={{ color: '#e0e0e0', fontSize: '12px' }}>Select a recipe to craft...</p>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4f2783',
            border: '1px solid #c084fc',
            color: '#c084fc',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

interface CharacterCreationOverlayProps {
  onCharacterCreated: () => void;
  initialLocation: string;
}

const CharacterCreationOverlay: React.FC<CharacterCreationOverlayProps> = ({
  onCharacterCreated,
  initialLocation
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '2px solid #4f2783',
          borderRadius: '8px',
          padding: '24px'
        }}
      >
        <h2 style={{ color: '#c084fc' }}>👤 Create Your Character</h2>
        <button
          onClick={onCharacterCreated}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4f2783',
            border: '1px solid #c084fc',
            color: '#c084fc',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default BetaApplication;
