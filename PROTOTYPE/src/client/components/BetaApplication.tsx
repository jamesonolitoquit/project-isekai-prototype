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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { calculateParadoxLevel, getAtmosphereState } from '../../engine/worldEngine';
import type { TradeState } from '../../engine/multiplayerEngine';
// import type { AtomicTrade } from '../../engine/atomicTradeEngine';

// Temporary type definition
type AtomicTrade = {
  tradeId: string;
  stage: 'proposed' | 'negotiating' | 'staged' | 'committing' | 'completed' | 'cancelled' | 'failed';
  initiatorId: string;
  responderId: string;
  initiatorItems: any[];
  responderItems: any[];
  createdAt: number;
  timeoutAt: number;
  failureReason?: string;
};
import BetaGlobalHeader from './BetaGlobalHeader';
import ErrorBoundary from './ErrorBoundary';
import CoDmDashboard from './CoDmDashboard';
import TutorialOverlayComponent from './TutorialOverlay';
import { AtmosphericFilterProvider } from './AtmosphericDebugVisual';
import ModeratorConsole from './ModeratorConsole';
import RetentionDashboard from './RetentionDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import { M69ErrorBoundary, M70ErrorBoundary, AnalyticsErrorBoundary } from './ErrorBoundaryWrappers';
import { useBroadcastListener, initBroadcastEngine } from '../../engine/broadcastEngine';
import {
  initializeTutorialState,
  detectMilestones,
  updateTutorialState,
  getNextTutorialOverlay,
  dismissTutorialOverlay,
  getTutorialArchive,
  startNewPlayerPrologue,
  isTutorialThrottled,
  getTier3Progress,
  type TutorialState
} from '../../engine/tutorialEngine';
import { themeManager } from '../../devTools/epochThemeManager';
import { getEpochSyncEngine } from '../../engine/epochSyncEngine';
// M42 Phase 2 Imports
import { TradeManager } from '../../engine/tradeManager';
import TradeOverlay from './TradeOverlay';
import WorldStateTransitionOverlay from './WorldStateTransitionOverlay';
import { transitionEngine, type TransitionMetadata } from '../../engine/transitionEngine';
import { createPhantomEngine, startPhantomEngine, stopPhantomEngine, type PhantomEngineState } from '../../engine/phantomEngine';
import { triggerDiplomatMilestone, triggerWeaverMilestone } from '../../engine/tutorialEngine';
import { getDiagnosticsSnapshot, type DiagnosticsSnapshot } from '../../engine/diagnosticsEngine';
// M42 Phase 4 Imports
import DirectorConsole from './DirectorConsole';
import { liveOpsEngine } from '../../engine/liveOpsEngine';
import NarrativeInterventionOverlay, { useNarrativeWhispers, type DirectorWhisper } from './NarrativeInterventionOverlay';
// Phase 13: Ascension Protocol
import AscensionProtocolView from './AscensionProtocolView';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MainTab = 'world' | 'social' | 'arcane' | 'records' | 'moderation' | 'retention' | 'analytics';

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
  const [isDirectorConsoleOpen, setIsDirectorConsoleOpen] = useState(false);
  const [tutorialState, setTutorialState] = useState<TutorialState>(initializeTutorialState());
  const [currentTutorialOverlay, setCurrentTutorialOverlay] = useState(getNextTutorialOverlay(tutorialState));

  // M42 Phase 2: Trade System
  const [showInventory, setShowInventory] = useState(false);
  const [showTradeUI, setShowTradeUI] = useState(false);
  const [activeTrade, setActiveTrade] = useState<AtomicTrade | null>(null);
  const [tradeManager] = useState(() => new TradeManager({
    clientId,
    getInventory: () => state?.player?.inventory ? new Map(state.player.inventory.map((i: any) => [i.itemId, i.quantity])) : new Map(),
    applyTransfer: (from: string, to: string, itemId: string, qty: number) => {
      performAction({ type: 'TRANSFER_ITEM', payload: { from, to, itemId, quantity: qty } });
      return true;
    },
    sendMessage: (msg: any) => {
      if (controller?.sendTradeMessage) {
        controller.sendTradeMessage(msg);
      }
    }
  }));
  const [showCraftingModal, setShowCraftingModal] = useState(false);

  // M42 Phase 2: Cinematic Transitions
  const [currentTransition, setCurrentTransition] = useState<TransitionMetadata | null>(null);
  const [lastEpochId, setLastEpochId] = useState<string | undefined>(state?.epochId);

  // M42 Phase 2: Phantom System
  const [phantomEngine] = useState<PhantomEngineState>(() =>
    createPhantomEngine({
      maxConcurrentPhantoms: 10,
      glowColor: '#0084ff',
      opacity: 0.35,
      playbackSpeed: 1.0,
      createEntity: (pos) => `phantom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      updateEntity: (entityId, update) => {
        // TODO: Update phantom entity in rendering engine
      },
      removeEntity: (entityId) => {
        // TODO: Remove phantom entity from rendering
      },
      fetchSessionLogs: async () => {
        // TODO: Fetch anonymized session logs from server
        return [];
      }
    })
  );

  // Faction AI diagnostics (M37)
  const [factionDiagnostics, setFactionDiagnostics] = useState<any>(null);

  // Macro Event diagnostics (M37)
  const [macroEventDiagnostics, setMacroEventDiagnostics] = useState<any>(null);

  // M42 Phase 4 Task 4.3: Narrative Intervention Overlay
  const { whisperQueue, addWhisper, removeWhisper } = useNarrativeWhispers();

  // Multiplayer info (M36)
  const [consensusDiagnostics, setConsensusDiagnostics] = useState<any>(null);

  // Phase 13: Ascension Protocol
  const [showAscensionOverlay, setShowAscensionOverlay] = useState(false);
  const [pendingAscensionData, setPendingAscensionData] = useState<any>(null);

  // Phase 24 Task 4: Tutorial & Onboarding System
  const [prologatePlayed, setProloguePlayed] = useState(false);
  const [tutorialArchive, setTutorialArchive] = useState(getTutorialArchive(tutorialState));

  // Phase 2: Real-time broadcast listeners for M69/M70
  const broadcastEvents = useBroadcastListener('*');
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  useEffect(() => {
    // Initialize broadcast engine on mount
    initBroadcastEngine();
  }, []);

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
      // M42 Phase 4: Director Console toggle (Ctrl+Shift+D)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDirectorConsoleOpen(prev => !prev);
        return;
      }

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
        '5': 'moderation',
        '6': 'retention',
        '7': 'analytics',
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
      
      // Phase 24: Update tutorial archive
      setTutorialArchive(getTutorialArchive(updated));
    }
  }, [state?.tick]); // Re-run when tick changes (new event occurred)

  // Phase 24 Task 4: Prologue trigger on character creation
  useEffect(() => {
    if (!state || state.needsCharacterCreation === true || prologatePlayed) return;

    // Character just created - trigger prologue whispers
    if (state.player && state.player.level === 1 && state.tick === 0) {
      setProloguePlayed(true);

      // Get prologue whisper sequence from tutorialEngine
      const prologueSequence = startNewPlayerPrologue();

      // Add whispers to queue with appropriate delays
      prologueSequence.forEach((whisper) => {
        setTimeout(() => {
          addWhisper(
            whisper.message,
            'director_primary',
            'normal',
            1500 // Show for 1.5 seconds
          );
        }, whisper.delayMs);
      });

      console.log('[BetaApp] Phase 24: Prologue sequence initiated');
    }
  }, [state?.needsCharacterCreation, state?.player?.level, state?.tick, prologatePlayed, addWhisper]);

  // M41 Task 5: Epoch-based theme morphing
  useEffect(() => {
    if (!state?.epochId) return;

    // Apply theme based on current epoch (1, 2, or 3)
    // Extract epoch number from string like "epoch_i_fracture"
    const epochMatch = state.epochId.match(/epoch_([iv]+)_/);
    if (epochMatch) {
      const romanNumeral = epochMatch[1].toLowerCase();
      const epochMap: Record<string, 1 | 2 | 3> = { 'i': 1, 'ii': 2, 'iii': 3 };
      const epoch = epochMap[romanNumeral];
      if (epoch) {
        themeManager.applyTheme(epoch, true);
      }
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

  // M42 Task 5: Subscribe to world state transition events
  useEffect(() => {
    const unsubscribe = transitionEngine.subscribeToTransition((event) => {
      if (event.type === 'START') {
        setCurrentTransition(event.metadata);
      } else if (event.type === 'FINISH') {
        setCurrentTransition(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // M42 Task 2: Phantom Engine Lifecycle
  useEffect(() => {
    if (!phantomEngine) return;

    // Start phantom engine on mount
    try {
      startPhantomEngine(phantomEngine);
      console.log('[BetaApp] Phantom engine started');
    } catch (error) {
      console.error('[BetaApp] Failed to start phantom engine:', error);
    }

    return () => {
      try {
        stopPhantomEngine(phantomEngine);
        console.log('[BetaApp] Phantom engine stopped');
      } catch (error) {
        console.error('[BetaApp] Failed to stop phantom engine:', error);
      }
    };
  }, [phantomEngine]);

  // M42 Task 2: Cinematic Transition Overlay Wiring
  useEffect(() => {
    if (!state?.epochId) return;

    // Detect epoch shift and trigger transition overlay
    if (lastEpochId !== undefined && state.epochId !== lastEpochId) {
      console.log(`[BetaApp] Epoch shifted: ${lastEpochId} → ${state.epochId}`);
      transitionEngine.startWorldTransition('epoch_shift', 800);
    }
    setLastEpochId(state.epochId);
  }, [state?.epochId, lastEpochId]);

  // M42 Task 3: Macro Event Transition Trigger
  useEffect(() => {
    if (!macroEventDiagnostics) return;

    // Trigger "world rebuild" glitch effect on catastrophic event
    if (macroEventDiagnostics.avgSeverity > 80 && macroEventDiagnostics.activeCount > 0) {
      console.log('[BetaApp] Macro event catastrophe detected - triggering transition');
      transitionEngine.startWorldTransition('paradox', 800);
    }
  }, [macroEventDiagnostics?.avgSeverity, macroEventDiagnostics?.activeCount]);

  // M42 Phase 4 Task 2: Live Ops Event Scheduler - Process scheduled events each tick
  useEffect(() => {
    if (!state || state.tick === undefined) return;

    // Process scheduled events for this tick
    const firedEvents = liveOpsEngine.processTick(state.tick);

    if (firedEvents.length > 0) {
      // Add fired events to state.macroEvents
      if (!state.macroEvents) {
        state.macroEvents = [];
      }

      firedEvents.forEach(fired => {
        const macroEvent = {
          id: fired.eventId,
          name: fired.eventName,
          category: fired.category,
          fireAt: state.tick,
          severity: fired.severity,
          description: fired.description,
          active: true,
          icon: fired.icon,
          factionImpact: fired.factionImpact,
          triggeredBy: 'LIVEOPS_SCHEDULER',
          timestamp: Date.now()
        };

        state.macroEvents.push(macroEvent);
        console.log(`[BetaApp] Live Ops event fired: ${fired.eventName} (${fired.scheduleId})`);

        // Trigger transition if catastrophic
        if (fired.category.includes('catastrophe') || fired.category.includes('apocalypse')) {
          transitionEngine.startWorldTransition('epoch_shift', 800);
        }
      });

      // Force state update to reflect new events
      setState({ ...state });
    }
  }, [state?.tick]);

  // M42 Task 5: Tier 2 Milestone Detection (Diplomat & Weaver)
  useEffect(() => {
    if (!state) return;

    // Check for Diplomat milestone (faction influence)
    const hasRecentFactionInfluence = state.factions?.some((f: any) =>
      f.recentInfluencers?.includes(state.player?.id) && 
      (f.consensusShiftedAt ?? 0) > Date.now() - 5000 // Within last 5 seconds
    );

    if (hasRecentFactionInfluence && !tutorialState.milestones.diplomat.achieved) {
      console.log('[BetaApp] Diplomat milestone detected');
      setTutorialState(triggerDiplomatMilestone(tutorialState));
      setCurrentTutorialOverlay(getNextTutorialOverlay(triggerDiplomatMilestone(tutorialState)));
    }

    // Check for Weaver milestone (3+ participant grand ritual)
    const hasGrandRitual = state.activeEvents?.some((e: any) =>
      e.type === 'grand_ritual' &&
      e.participants?.length >= 3 &&
      e.participants?.includes(state.player?.id)
    );

    if (hasGrandRitual && !tutorialState.milestones.weaver.achieved) {
      console.log('[BetaApp] Weaver milestone detected');
      setTutorialState(triggerWeaverMilestone(tutorialState));
      setCurrentTutorialOverlay(getNextTutorialOverlay(triggerWeaverMilestone(tutorialState)));
    }
  }, [state?.factions, state?.activeEvents, state?.player?.id, tutorialState]);

  // Phase 13: Ascension Protocol Event Detection
  useEffect(() => {
    if (!state?.activeEvents) return;

    // Look for ASCENSION_PROTOCOL_INITIATED event
    const ascensionEvent = state.activeEvents.find((e: any) => e.type === 'ASCENSION_PROTOCOL_INITIATED');
    
    if (ascensionEvent && !showAscensionOverlay) {
      console.log('[BetaApp] Ascension protocol initiated:', ascensionEvent);
      setPendingAscensionData(ascensionEvent);
      setShowAscensionOverlay(true);
    }
  }, [state?.activeEvents, showAscensionOverlay]);

  // M42 Task 4: Real-time Diagnostic Panel Wiring
  useEffect(() => {
    if (!state) return;

    // Compute diagnostics snapshot for real-time display
    const snapshot = getDiagnosticsSnapshot(state, undefined, [], {
      totalProposals: 0,
      successfulProposals: 0
    });

    // Update faction diagnostics
    setFactionDiagnostics({
      factionPowers: snapshot.factionPowers,
      activeCount: snapshot.factionPowers.length,
      avgPower: snapshot.factionPowers.length > 0
        ? snapshot.factionPowers.reduce((sum, f) => sum + f.totalPower, 0) / snapshot.factionPowers.length
        : 0
    });

    // Update macro event diagnostics
    setMacroEventDiagnostics({
      events: snapshot.macroEventCountdowns,
      activeCount: snapshot.macroEventCountdowns.length,
      avgSeverity: snapshot.macroEventCountdowns.length > 0
        ? snapshot.macroEventCountdowns.reduce((sum, e) => sum + e.severity, 0) / snapshot.macroEventCountdowns.length
        : 0,
      urgentEvents: snapshot.macroEventCountdowns.filter(e => e.etaTicks < 100).length
    });

    // Update consensus diagnostics
    setConsensusDiagnostics({
      consensusHealth: snapshot.consensusHealth,
      consensusSuccessRate: 95, // TODO: Calculate from proposal metrics
      peerCount: snapshot.consensusHealth.peerCount,
      syncLatency: snapshot.consensusHealth.avgLatency,
      healthStatus: snapshot.consensusHealth.healthStatus
    });
  }, [state?.tick, state?.factions, state?.activeEvents]);

  // Phase 2: Process broadcast events for M69/M70 dashboards
  useEffect(() => {
    if (!broadcastEvents || broadcastEvents.length === 0) {
      return;
    }

    // Filter and organize broadcast events
    const reports = broadcastEvents
      .filter((e) => e.type === 'exploit_detected')
      .map((e) => ({
        reportId: `${e.data.playerId}-${e.timestamp}`,
        playerId: e.data.playerId,
        reportType: e.data.exploitType,
        reason: `Exploit detected: ${e.data.exploitType}`,
        severity: e.severity as 'critical' | 'high' | 'low',
        reviewed: false,
        timestamp: e.timestamp,
      }));

    const messages = broadcastEvents
      .filter((e) => e.type === 'chat_flagged')
      .map((e) => ({
        messageId: e.data.messageId,
        playerId: e.data.playerId,
        flaggedReason: e.data.reason,
        action: 'none' as const,
        timestamp: e.timestamp,
      }));

    const anomalyList = broadcastEvents
      .filter((e) => e.type === 'anomaly_flagged')
      .map((e) => ({
        anomalyId: `${e.data.anomalyType}-${e.timestamp}`,
        anomalyType: e.data.anomalyType,
        severity: e.severity as 'critical' | 'high',
        affectedPlayers: e.data.playersAffected.length,
        timestamp: e.timestamp,
      }));

    setRecentReports(reports.slice(-20));
    setFlaggedMessages(messages.slice(-20));
    setAnomalies(anomalyList.slice(-20));
  }, [broadcastEvents]);

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
    // M42: Use AtomicTradeEngine for high-integrity P2P trading
    const result = tradeManager.initiateTraade(responderId, initiatorItems, responderItems);
    
    if (!result.success) {
      console.error('[BetaApp] Trade initiation failed:', result.error);
      alert(`Trade failed: ${result.error}`);
      return;
    }

    if (result.trade) {
      setActiveTrade(result.trade as unknown as AtomicTrade);
      setShowTradeUI(true);

      // Subscribe to trade updates
      tradeManager.subscribe(result.trade.tradeId, (updatedTrade) => {
        setActiveTrade(updatedTrade as unknown as AtomicTrade);
        
        if (updatedTrade.stage === 'completed') {
          console.log('[BetaApp] Trade completed successfully');
          setTimeout(() => {
            setShowTradeUI(false);
            setActiveTrade(null);
          }, 2000);
        } else if (updatedTrade.stage === 'failed' || updatedTrade.stage === 'cancelled') {
          console.warn('[BetaApp] Trade failed:', updatedTrade.failureReason);
          setTimeout(() => {
            setShowTradeUI(false);
            setActiveTrade(null);
          }, 1500);
        }
      });
    }
  }, [tradeManager]);

  const handleTradeConfirm = useCallback(() => {
    if (!activeTrade) return;

    // Stage 3: Lock items
    if (activeTrade.stage === 'negotiating') {
      const stageResult = tradeManager.stageItems(activeTrade.tradeId);
      if (!stageResult.success) {
        console.error('[BetaApp] Failed to stage items:', stageResult.error);
        alert(stageResult.error);
        return;
      }
    }

    // Stage 4: Commit to trade
    if (activeTrade.stage === 'staged' || activeTrade.stage === 'committing') {
      const commitResult = tradeManager.commitToTrade(activeTrade.tradeId);
      if (!commitResult.success) {
        console.error('[BetaApp] Failed to commit:', commitResult.error);
        alert(commitResult.error);
        return;
      }
    }
  }, [activeTrade, tradeManager]);

  const handleTradeCancel = useCallback(() => {
    if (!activeTrade) return;

    const cancelResult = tradeManager.cancelTrade(activeTrade.tradeId, 'User cancelled');
    if (!cancelResult.success) {
      console.error('[BetaApp] Failed to cancel trade');
    }

    setActiveTrade(null);
    setShowTradeUI(false);
  }, [activeTrade, tradeManager]);

  // Phase 13: Ascension Protocol Handlers
  const handleAscensionConfirm = useCallback((selectedDeeds: string[], selectedHeirloom?: string) => {
    console.log('[BetaApp] Ascension confirmed:', { selectedDeeds, selectedHeirloom });
    
    // Dispatch FINALIZE_TRANSCENDENCE action
    performAction({
      type: 'FINALIZE_TRANSCENDENCE',
      payload: {
        selectedDeeds,
        selectedHeirloom,
        confirmedAt: Date.now()
      }
    });

    // Close overlay after a brief delay to allow animation
    setTimeout(() => {
      setShowAscensionOverlay(false);
      setPendingAscensionData(null);
    }, 3000);
  }, [performAction]);

  const handleAscensionCancel = useCallback(() => {
    console.log('[BetaApp] Ascension cancelled');
    setShowAscensionOverlay(false);
    setPendingAscensionData(null);
  }, []);

  // Phase 24 Task 4: Tutorial overlay dismissal handler
  const handleTutorialDismiss = useCallback(() => {
    // Check if tutorial is throttled (raid in progress or high density)
    if (isTutorialThrottled(state)) {
      console.log('[BetaApp] Tutorial throttled - deferred');
      // Don't show overlay, but still process the dismiss logic
    }

    // Dispatch DISMISS_TUTORIAL action to backend
    if (currentTutorialOverlay?.id) {
      performAction({
        type: 'DISMISS_TUTORIAL',
        payload: {
          milestoneId: currentTutorialOverlay.id
        }
      });
    }

    // Mark tutorial show time for throttle tracking
    setLastTutorialShowTime(Date.now());

    // Move to next tutorial overlay
    setCurrentTutorialOverlay(getNextTutorialOverlay(tutorialState));
  }, [currentTutorialOverlay, state, performAction, tutorialState]);

  // =========================================================================
  // RENDER: MAIN LAYOUT
  // =========================================================================

  return (
    <div
      className="atmospheric-filter-root"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#0d0d1a',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(79, 39, 131, 0.2), transparent)',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.5s ease, background-image 0.5s ease, filter 0.3s ease'
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

          {/* M44-E3: Tab Content wrapped with Atmospheric Filters (Phase 25 Task 1: Enhanced) */}
          {useMemo(() => {
            const paradoxLevel = calculateParadoxLevel(state);
            const atmosphereState = getAtmosphereState(state);
            const ageRotSeverity = state.ageRotSeverity || 'mild';
            const socialTension = state.socialTension ?? 0;
            
            return (
              <AtmosphericFilterProvider 
                paradoxLevel={paradoxLevel}
                ageRotSeverity={ageRotSeverity}
                socialTension={socialTension}
                paradoxMax={300}
                intensityMultiplier={1.0}
              >
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

            {activeMainTab === 'moderation' && (
              <div aria-labelledby="moderation-tab">
                <M69ErrorBoundary>
                  <ModeratorConsole />
                </M69ErrorBoundary>
              </div>
            )}

            {activeMainTab === 'retention' && (
              <div aria-labelledby="retention-tab">
                <M70ErrorBoundary panelName="Player Retention Dashboard">
                  <RetentionDashboard />
                </M70ErrorBoundary>
              </div>
            )}

            {activeMainTab === 'analytics' && (
              <div aria-labelledby="analytics-tab">
                <AnalyticsErrorBoundary>
                  <AnalyticsDashboard
                    cohortMetrics={{
                      dau: 127,
                      mau: 1042,
                      sessionLength: 38,
                      retention: { day1: 92, day7: 68, day30: 42 }
                    }}
                    segmentDistribution={{
                      ultra_core: 142,
                      core: 524,
                      regular: 287,
                      casual: 156,
                      at_risk: 31
                    }}
                    churnPredictions={[
                      {
                        riskLevel: 'high',
                        playersAffected: 31,
                        confidence: 87,
                        topReasons: ['No playtime >7 days', 'Low engagement score', 'Missed event streak']
                      }
                    ]}
                    campaignMetrics={[
                      {
                        campaignId: 'camp_001',
                        name: 'Friend Activity Boost',
                        type: 'friend_activity',
                        sentTo: 142,
                        accepted: 89,
                        reengaged: 52,
                        reuseRate: 58
                      }
                    ]}
                  />
                </AnalyticsErrorBoundary>
              </div>
            )}
            </div>
              </AtmosphericFilterProvider>
            );
          }, [state])}
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

      {/* M42 Phase 2: High-Integrity Trade Overlay */}
      {showTradeUI && activeTrade && (
        <TradeOverlay
          trade={activeTrade}
          clientId={clientId}
          clientInventory={state?.player?.inventory ? new Map(state.player.inventory.map((i: any) => [i.itemId, i.quantity])) : new Map()}
          partnerInventory={new Map()} // TODO: Fetch from state or P2P
          onTradeUpdate={(updatedTrade) => {
            setActiveTrade(updatedTrade as unknown as AtomicTrade);
            tradeManager.subscribe(updatedTrade.tradeId, (t) => setActiveTrade(t as unknown as AtomicTrade));
          }}
          onTradeComplete={(completedTrade) => {
            console.log('[BetaApp] Trade completed:', completedTrade.tradeId);
            setTimeout(() => {
              setShowTradeUI(false);
              setActiveTrade(null);
            }, 1500);
          }}
          onCancel={() => {
            handleTradeCancel();
          }}
          allowBarterCheck={true}
          barterSkillBonus={state.player?.stats?.cha || 0}
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

      {/* M42 Phase 2: Cinematic Transition Overlay */}
      {currentTransition && (
        <WorldStateTransitionOverlay
          transitionType={currentTransition.reason as 'epoch_shift' | 'world_reset' | 'macro_event'}
          duration={currentTransition.estimatedDuration}
          message={`Rebuilding ${currentTransition.reason.replace('_', ' ')}...`}
          onComplete={() => setCurrentTransition(null)}
        />
      )}

      {/* Phase 13: Ascension Protocol Overlay */}
      {showAscensionOverlay && pendingAscensionData && state?.player && (
        <AscensionProtocolView
          character={state.player}
          legacyImpact={pendingAscensionData.legacyImpact || {
            id: '',
            ancestralBooms: [],
            ancestralBlights: [],
            canonicalDeeds: [],
            heirlooms: []
          }}
          generationalParadox={state.generationalParadox || 0}
          allDeeds={pendingAscensionData.selectedDeeds || []}
          worldState={state}
          onConfirmAscension={handleAscensionConfirm}
          onCancelAscension={handleAscensionCancel}
          isDeveloperMode={isDirector}
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

      {/* M42 Phase 4 Task 1: Director Console */}
      {isDirector && (
        <DirectorConsole
          state={state}
          controller={controller}
          multiplayerEngine={undefined}
          transitionEngine={transitionEngine}
          diagnosticsEngine={undefined}
          mutationLog={[]}
          isOpen={isDirectorConsoleOpen}
          onToggle={setIsDirectorConsoleOpen}
          isDirectorMode={isDirector}
        />
      )}

      {/* M42 Phase 4 Task 4.3: Narrative Intervention Overlay - Director Whispers */}
      <NarrativeInterventionOverlay
        whisperQueue={whisperQueue}
        onWhisperComplete={removeWhisper}
        currentEpoch={state?.epochId?.includes('i') ? 1 : state?.epochId?.includes('ii') ? 2 : 3}
        playerName={state?.player?.name}
        enableAudio={true}
      />

      {/* M41 Task 2: Tutorial Overlay - Phase 24: With throttle checking */}
      {currentTutorialOverlay && !isTutorialThrottled(state) && (
        <TutorialOverlayComponent
          overlay={currentTutorialOverlay}
          onDismiss={handleTutorialDismiss}
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
    { id: 'records', label: '📖 Records (4)', ariaLabel: 'Records tab - Press 4 to activate' },
    { id: 'moderation', label: '🛡️ Moderation (5)', ariaLabel: 'Moderation tab - Press 5 to activate' },
    { id: 'retention', label: '🎯 Retention (6)', ariaLabel: 'Retention tab - Press 6 to activate' },
    { id: 'analytics', label: '📊 Analytics (7)', ariaLabel: 'Analytics tab - Press 7 to activate' }
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
          <div>Time: <span style={{ color: '#c084fc' }}>
            {state.hour.toString().padStart(2, '0')}:{ (state.time?.minute ?? 0).toString().padStart(2, '0') }
          </span></div>
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
          Paradox Level: {state.paradoxLevel || 0}%
        </p>
        <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>
          Temporal Paradoxes: {state.temporalParadoxes?.length || 0}
        </p>
      </div>
    </div>
  );
};

interface BetaRecordsPanelProps {
  state: WorldState;
}

const BetaRecordsPanel: React.FC<BetaRecordsPanelProps> = ({ state }) => {
  const [recordsTab, setRecordsTab] = React.useState<'chronicles' | 'deeds' | 'tutorials' | 'whispers'>('chronicles');
  const tutorialArchive = React.useMemo(() => getTutorialArchive(state?.player?.tutorialProgress || initializeTutorialState()), [state?.player?.tutorialProgress]);
  const tier3Progress = React.useMemo(() => getTier3Progress(state?.player?.tutorialProgress || initializeTutorialState()), [state?.player?.tutorialProgress]);

  return (
    <div>
      <h2 style={{ color: '#c084fc', marginBottom: '16px' }}>📖 Chronicles & Records</h2>

      {/* Records Tab Navigation - M40 Task 4: Add ARIA labels - Phase 24: Added tutorials */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }} role="tablist" aria-label="Records tabs">
        {(['chronicles', 'deeds', 'tutorials', 'whispers'] as const).map(tab => {
          const getAriaLabel = (tab: 'chronicles' | 'deeds' | 'tutorials' | 'whispers') => {
            if (tab === 'chronicles')
              return 'Chronicles tab - Timeline showing world history';
            if (tab === 'deeds')
              return 'Deeds tab - Your legendary actions';
            if (tab === 'tutorials')
              return 'Tutorials tab - Your discovered milestones and learning archive';
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
              {tab === 'tutorials' && '🎓 Tutorials'}
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

      {/* Phase 24 Task 4: Tutorials Sub-Pane */}
      {recordsTab === 'tutorials' && (
        <div
          role="tabpanel"
          aria-labelledby="tutorials-tab"
          style={{
            backgroundColor: 'rgba(79, 39, 131, 0.1)',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #333'
          }}
        >
          <h3 style={{ color: '#a78bfa', fontSize: '13px', margin: '0 0 12px 0' }}>
            🎓 Tutorial Archive
          </h3>
          <p style={{ fontSize: '11px', color: '#999', margin: '0 0 12px 0' }}>
            Milestones you've discovered and mastered in your journey.
          </p>

          {/* Tutorial Progress */}
          {tier3Progress && (
            <div
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                padding: '8px 12px',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '11px',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}
            >
              <div style={{ marginBottom: '6px', color: '#c084fc' }}>
                <strong>Progress:</strong> {tier3Progress.completed} / {tier3Progress.total} Tier 3 Milestones
              </div>
            </div>
          )}

          {/* Achieved Tutorials */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              backgroundColor: 'rgba(13, 13, 26, 0.5)',
              padding: '8px',
              borderRadius: '3px',
              border: '1px solid #4f2783'
            }}
          >
            {tutorialArchive && tutorialArchive.length > 0 ? (
              tutorialArchive.map((tutorial: any, idx: number) => (
                <div
                  key={tutorial.milestoneId || idx}
                  style={{
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #333',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ color: '#c084fc', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{tutorial.icon || '📖'}</span>
                    <span>{tutorial.title}</span>
                  </div>
                  <div style={{ color: '#a78bfa', marginBottom: '4px', fontSize: '10px' }}>
                    {tutorial.text}
                  </div>
                  <div
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderLeft: '4px solid #8b5cf6',
                      borderRadius: '3px',
                      padding: '6px 8px',
                      fontSize: '9px',
                      color: '#a78bfa',
                      fontStyle: 'italic',
                      marginTop: '4px'
                    }}
                  >
                    {tutorial.loreText}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#666', fontSize: '11px', fontStyle: 'italic' }}>
                No milestones discovered yet. Continue your journey to unlock tutorials.
              </div>
            )}
          </div>
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
            {state?.narrativeInterventions && state.narrativeInterventions.length > 0 ? (
              state.narrativeInterventions.map((whisper: any, idx: number) => (
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
