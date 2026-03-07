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
import type { WorldController } from '../../types/engines';
import type { TradeState } from '../../engine/multiplayerEngine';
import type { AtomicTrade } from '../../engine/atomicTradeEngine';
import BetaGlobalHeader from './BetaGlobalHeader';
import GlobalErrorBoundary from './GlobalErrorBoundary'; // Phase 30 Task 6: Diegetic Error Boundary
import ErrorBoundary from './ErrorBoundary'; // M40 Task 3: Tab panel error boundaries
import CoDmDashboard from './CoDmDashboard';
import DiegeticLoadingOverlay from './DiegeticLoadingOverlay'; // Phase 48-UI: Loading screen
import { useAtmosphericFilter, AtmosphericFilterProvider } from '../hooks/useAtmosphericFilter'; // BETA Phase 1: Pressure Sink
// Phase 10.5: UI Layer - Oracle View (Extraction Remediations)
import { useUIWorldMapper, useApplyAtmosphericCSS } from '../hooks/useUIWorldMapper';
import type { UIWorldModel } from '../types/uiModel';
import {
  initializeTutorialState,
  detectMilestones,
  updateTutorialState,
  getNextTutorialOverlay,
  dismissTutorialOverlay,
  type TutorialState
} from '../../engine/tutorialEngine';
// import { themeManager } from '../../devTools/epochThemeManager'; // [M48-A4: Temporarily disabled - missing module]
import { getEpochSyncEngine } from '../../engine/epochSyncEngine';
// M42 Phase 2 Imports
import { TradeManager } from '../../engine/tradeManager';
// import TradeOverlay from './TradeOverlay'; // [M48-A4: Temporarily disabled - missing component]
// import WorldStateTransitionOverlay from './WorldStateTransitionOverlay'; // [M48-A4: Temporarily disabled - missing component]
import { transitionEngine, type TransitionMetadata } from '../../engine/transitionEngine';
import { createPhantomEngine, startPhantomEngine, stopPhantomEngine, type PhantomEngineState } from '../../engine/phantomEngine';
import { triggerDiplomatMilestone, triggerWeaverMilestone } from '../../engine/tutorialEngine';
import { getDiagnosticsSnapshot, type DiagnosticsSnapshot } from '../../engine/diagnosticsEngine';
// M42 Phase 4 Imports
// import DirectorConsole from './DirectorConsole'; // [M48-A4: Temporarily disabled - missing component]
import { liveOpsEngine } from '../../engine/liveOpsEngine';

// Phase 3 Task 3: Narrative Intervention Overlay Integration
import NarrativeInterventionOverlay, { type DirectorWhisper } from './NarrativeInterventionOverlay';
import { useNarrativeWhispers, eventToWhisper, type WhisperDisplay } from '../hooks/useNarrativeWhispers';
import { getEventsForWorld } from '../../events/mutationLog'; // For tracking DIRECTOR_WHISPER events

// Phase 3 Task 4: Temporal Rewind Panel Integration
import RewindPanel from './RewindPanel';

// Phase 3 Task 5: Director Command Input
import DirectorCommandInput from './DirectorCommandInput';

// Phase 10: Hero's Reliquary HUD System (Gameplay UI Convergence)
import PlayerHUDContainer from './PlayerHUDContainer';

// Phase 9 Task 2: Director Console & Pressure Sink Panel
import PressureSinkPanel from './PressureSinkPanel';

// Beta Phase 5 Task 1: Atmospheric Pressure Indicator (Diegetic Pressure Sink)
import AtmosphericPressureIndicator from './AtmosphericPressureIndicator';

// Beta Phase 5 Task 1: Paradox Bleed Visualizer (Background distortion effects)
import ParadoxBleedVisualizer from './ParadoxBleedVisualizer';

// Phase 30 Task 4: Weaver Processing Indicator (AI Synthesis Latency)
import WeaverProcessingIndicator, { type WeaverProcessingState } from './WeaverProcessingIndicator';

// Phase 4 Task 1: Director Telemetry HUD
import DirectorTelemetryHUD from './DirectorTelemetryHUD';

// Phase 4 Task 2: Ritual Consensus UI (Grand Ritual Voting)
import RitualConsensusUI, { type GrandRitual } from './RitualConsensusUI';

// Phase 4 Task 3: AI Weaver Settings (BYOK Configuration)
import { WeaverSettings } from './WeaverSettings';

// Phase 4 Task 5: Architect's Forge (Live Mutation)
import ArchitectForge from './ArchitectForge';

// Character Creation System
import CharacterCreationOverlay from './CharacterCreationOverlay';

// Phase 19: Tutorial System
import TutorialOverlay from './TutorialOverlay';

// Phase 30 Task 8: The Awakening Sequence (Cinematic Origin Story)
import CinematicTextOverlay from './CinematicTextOverlay';
import { getAIService } from '../services/AIService';

// Phase 30 Task 9: Diegetic Theme Manager (Narrative Codecs)
import { themeManager } from '../services/themeManager';

// Phase 30 UI: Tabletop Container (Digital Board Game aesthetic)
import TabletopContainer from './TabletopContainer';

// Phase 32: Physical HUD Panels
import InventoryPanel from './InventoryPanel';
import QuestPanel from './QuestPanel';

// Phase 34: Gameplay Center Stage
import { GameStage } from './GameStage';

// Phase 34: Footer bar (toasts, autosave, shortcuts)
import { GameFooter } from './GameFooter';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MainTab = 'world' | 'social' | 'arcane' | 'records';

export interface BetaApplicationProps {
  initialState: WorldState;
  controller: WorldController;
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

  const [state, setState] = useState<WorldState | null>(initialState || null);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('world');
  const [isDirector, setIsDirector] = useState(false);
  const [isDirectorConsoleOpen, setIsDirectorConsoleOpen] = useState(false);
  // Phase 4: Troubleshooter's Seal - debug mode toggle with Ctrl+Shift+D hotkey
  const [debugModeActive, setDebugModeActive] = useState(() => {
    if (typeof window !== 'undefined' && process.env.REACT_APP_DEBUG_HUD === 'true') {
      return true;
    }
    return false;
  });

  // Log state after initialization
  if (state?.needsCharacterCreation) {
    console.log('BetaApplication - Character creation needed for:', state?.player?.name);
  }
  const [tutorialState, setTutorialState] = useState<TutorialState>(initializeTutorialState());
  const [currentTutorialOverlay, setCurrentTutorialOverlay] = useState(getNextTutorialOverlay(initializeTutorialState()));

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
      if ((controller as any)?.sendTradeMessage) {
        (controller as any).sendTradeMessage(msg);
      }
    }
  }));
  const [showCraftingModal, setShowCraftingModal] = useState(false);

  // Phase 3 Task 4: Temporal Rewind Panel
  const [showRewindPanel, setShowRewindPanel] = useState(false);

  // Phase 30 Task 4: Weaver AI Processing Status
  const [weaverProcessing, setWeaverProcessing] = useState<WeaverProcessingState | null>(null);

  // Phase 30 Task 8: The Awakening Sequence
  const [showAwakening, setShowAwakening] = useState(false);
  const [originStory, setOriginStory] = useState<string>('');
  const [isAwakeningComplete, setIsAwakeningComplete] = useState(false);
  const [awakeSynthesisFailed, setAwakeSynthesisFailed] = useState(false);

  // Phase 3 Task 5: Director Command Input
  const [commandStatus, setCommandStatus] = useState('');
  const [lastCommandEvent, setLastCommandEvent] = useState<any>(null);

  // Phase 4 Task 1: Director Telemetry HUD
  const [telemetryMinimized, setTelemetryMinimized] = useState(false);
  const [recentLatencies, setRecentLatencies] = useState<number[]>([]);

  // Phase 4 Task 2: Ritual Consensus UI
  const [activeRitual, setActiveRitual] = useState<GrandRitual | null>(null);

  // Phase 4 Task 3: AI Weaver Settings Modal
  const [isWeaverSettingsOpen, setIsWeaverSettingsOpen] = useState(false);

  // Phase 4 Task 5: Architect's Forge Modal
  const [isArchitectForgeOpen, setIsArchitectForgeOpen] = useState(false);

  // M42 Phase 2: Cinematic Transitions
  const [currentTransition, setCurrentTransition] = useState<TransitionMetadata | null>(null);
  // const [lastEpochId, setLastEpochId] = useState<string | undefined>(state?.epochId); // [M48-A4: epochId not in WorldState]

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

  // Narrative Intervention Overlay - M42 Phase 4 Task 4.3 [M48-A4: Disabled]
  // const { whisperQueue, addWhisper, removeWhisper } = useNarrativeWhispers();

  // Multiplayer info (M36)
  const [consensusDiagnostics, setConsensusDiagnostics] = useState<any>(null);

  // Phase 7: Socket.IO connection for real-time updates
  const [socket, setSocket] = useState<any>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // BETA Phase 1: Pressure Sink - Atmospheric Filter for Paradox Visualization
  const atmosphericFilters = useAtmosphericFilter({
    paradoxLevel: state?.paradoxLevel ?? 0,
    ageRotSeverity: state?.ageRotSeverity ?? 'mild'
  });

  // Phase 10.5: UI World Model - Derived view for type-safe UI rendering
  const uiModel = useUIWorldMapper(state, state?.player?.id || null);
  useApplyAtmosphericCSS(uiModel.atmosphere);

  // Phase 3 Task 3: Narrative Intervention Overlay - Whisper tracking
  const { activeWhisper, addWhisper, dismissWhisper, whisperHistory } = useNarrativeWhispers();
  const [lastProcessedWhisperEventId, setLastProcessedWhisperEventId] = useState<string | null>(null);

  // =========================================================================
  // EFFECTS
  // =========================================================================

  // Phase 30 Task 9: Initialize Theme Manager on component mount
  useEffect(() => {
    // Theme manager is a singleton and initializes itself on first getInstance() call
    // This effect ensures the theme is loaded from localStorage when component mounts
    const currentCodec = themeManager.getCodec();
    console.log('[BetaApp] Theme initialized:', currentCodec);
  }, []);

  useEffect(() => {
    console.log('BetaApplication useEffect - controller:', !!controller, 'initialState:', initialState);
    if (!controller) return;

    // Subscribe to state updates
    let unsubscribe: (() => void) | null = null;
    const ctrl = controller as any; // Phase 7: Runtime method checking

    if (ctrl.subscribe) {
      unsubscribe = ctrl.subscribe((newState: WorldState) => {
        console.log('[BetaApp] SUBSCRIBE UPDATE RECEIVED:', {
          needsCharacterCreation: newState.needsCharacterCreation,
          playerName: newState.player?.name,
          playerId: newState.player?.id,
          ancestryTree: newState.player?.ancestryTree,
          tick: newState.tick
        });
        setState(newState);
      });
    } else {
      // Fallback: poll for state
      const pollId = setInterval(() => {
        try {
          const latest = ctrl.getState?.();
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

    if (ctrl.start) {
      ctrl.start();
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (ctrl.stop) ctrl.stop();
    };
  }, [controller]);

  // Phase 7: Initialize Socket.IO connection
  // TEMPORARILY DISABLED - Force Local Offline Mode for Phase 47 testing
  useEffect(() => {
    console.log('🎮 Running in LOCAL OFFLINE MODE (Socket.IO disabled)');
    setSocketConnected(false);
    return () => {};
  }, []);

  // M40 Task 4: Keyboard navigation (1-4 for tab switching, Shift+D for Director Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Phase 4: Troubleshooter's Seal - Debug mode toggle (Ctrl+Shift+D)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDebugModeActive(prev => !prev);
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
      
      // Phase 30 Task 4: Use async synthesis for enhanced tutorial overlays
      // Get synchronous overlay first for immediate display
      const syncOverlay = getNextTutorialOverlay(updated);
      setCurrentTutorialOverlay(syncOverlay);
      
      // Then attempt async AI enhancement if available
      (async () => {
        try {
          const { getNextTutorialOverlayAsync } = await import('../../engine/tutorialEngine');
          const knowledgeLevel = 0; // TODO: Calculate based on player progress
          const asyncOverlay = await getNextTutorialOverlayAsync(updated, state, knowledgeLevel);
          if (asyncOverlay) {
            setCurrentTutorialOverlay(asyncOverlay);
          }
        } catch (error) {
          console.debug('[BetaApp] Async tutorial synthesis skipped:', error);
          // Fall back to sync overlay, which is already displayed
        }
      })();
      
      console.log('[BetaApp] Tutorial milestones detected:', detected);
    }
  }, [state?.tick, state?.player?.inventory?.length, state?.quests?.length]);

  // Phase 3 Task 3: Track whisper events from event log
  useEffect(() => {
    if (!state?.id) return;

    try {
      const events = getEventsForWorld(state.id);
      // Find new whisper events since last checkpoint
      const newWhispers = events.filter(e => {
        const isWhisper = e.type === 'DIRECTOR_WHISPER' || e.type === 'RELIC_WHISPER';
        const isNew = !lastProcessedWhisperEventId || (e.eventIndex || 0) > (parseInt(lastProcessedWhisperEventId) || 0);
        return isWhisper && isNew;
      });

      if (newWhispers.length > 0) {
        // Convert events to whisper display format and add to queue
        newWhispers.forEach(event => {
          const whisper = eventToWhisper(event);
          if (whisper) {
            addWhisper(whisper);
            setLastProcessedWhisperEventId(String(event.eventIndex || 0));
          }
        });
      }
    } catch (err) {
      console.warn('[BetaApplication] Failed to track whisper events:', err);
    }
  }, [state?.id, state?.tick, lastProcessedWhisperEventId, addWhisper]);

  // Previous tutorial useEffect was here
  // } // [M48-A4: Disabled - references disabled functions]
  // }, [state, tutorialState]);
  //   }

  // Phase 30 Task 5: Quest Synthesis AI Enhancement
  useEffect(() => {
    if (!state?.quests || state.quests.length === 0) return;

    // Track which quests we've already enhanced
    const enhancedQuests = new Set<string>();
    
    const enhanceNewQuests = async () => {
      try {
        // Import questSynthesisAI instance
        const { getQuestSynthesisAI } = await import('../../engine/questSynthesisAI');
        const questSynthesis = getQuestSynthesisAI?.();
        
        if (!questSynthesis) return;

        // Find quests that haven't been enhanced yet
        const newQuests = state.quests.filter((q: any) => !enhancedQuests.has(q.id));
        
        if (newQuests.length > 0) {
          // Fire off async enhancement without blocking
          questSynthesis.batchEnhanceQuestsWithAI(newQuests as any, state)
            .then(() => {
              // Mark as enhanced
              newQuests.forEach((q: any) => enhancedQuests.add(q.id));
              console.log('[BetaApp] Enhanced', newQuests.length, 'quests with AI');
            })
            .catch((error) => {
              console.warn('[BetaApp] Quest enhancement failed:', error);
            });
        }
      } catch (error) {
        console.debug('[BetaApp] Quest synthesis unavailable:', error);
        // Quests continue without enhancement if synthesis not available
      }
    };

    enhanceNewQuests();
  }, [state?.quests?.length, state?.id]);
  // }, [state?.tick]); // Re-run when tick changes (new event occurred)

  // Phase 30 Task 8: The Awakening Sequence - Trigger AI Origin Story Synthesis
  useEffect(() => {
    if (!state?.player || state.needsCharacterCreation !== false || isAwakeningComplete || showAwakening) {
      return;
    }

    // Setup AbortController and mount tracker for cleanup
    const abortController = new AbortController();
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    // Character was just created, now synthesize the awakening sequence
    const triggerAwakening = async () => {
      try {
        // Guard: check mount status before first state update
        if (!isMounted) return;

        setWeaverProcessing({
          isProcessing: true,
          latencyMs: 0,
          synthesisType: 'tutorial',
          progress: 0
        });

        const aiService = getAIService();
        
        // Set a 5-second timeout for AI synthesis - if no response, use fallback
        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          console.warn('[BetaApp] Awaiting synthesis timeout (5s) - using fallback story');
          abortController.abort();
        }, 5000);
        
        // Synthesize origin story with character details, passing abort signal
        const result = await aiService.synthesize({
          type: 'story_origin',
          factors: {
            characterName: state.player?.name || 'The Traveler',
            race: (state.player as any)?.race || 'Human',
            archetype: (state.player as any)?.archetype || 'Wanderer',
            additionalContext: `You are awakening in ${state.metadata?.name || 'Luxfier'}, a world of paradox and wonder.`
          },
          paradoxLevel: state.paradoxLevel ?? 0,
          signal: abortController.signal
        });

        // Guard: verify component still mounted before state updates
        if (!isMounted) return;
        
        // Clear timeout if synthesis completed
        if (timeoutId) clearTimeout(timeoutId);

        setOriginStory(result.content);
        setShowAwakening(true);
        setWeaverProcessing(null);
        console.log('[BetaApp] Awakening sequence triggered, origin story synthesized:', result.latency, 'ms');
      } catch (error) {
        // Silent cancellation if aborted (includes timeout abort)
        if ((error as any).name === 'AbortError') {
          console.log('[BetaApp] Awakening synthesis aborted - using fallback story');
          // Proceed with fallback story on abort/timeout
          if (isMounted) {
            setOriginStory(
              `You awaken to the vast expanse of ${state.metadata?.name || 'Luxfier'}, a world caught between symmetry and paradox. `
              + `Your name is ${state.player?.name || 'The Traveler'}, and your story is about to unfold.`
            );
            setShowAwakening(true);
            setWeaverProcessing(null);
          }
          return;
        }

        // Guard: verify component still mounted before error handling
        if (!isMounted) return;

        console.error('[BetaApp] Awakening synthesis failed:', error);
        setAwakeSynthesisFailed(true);
        setWeaverProcessing(null);
        
        // Fall back to a default message on any error
        setOriginStory(
          `You awaken to the vast expanse of ${state.metadata?.name || 'Luxfier'}, a world caught between symmetry and paradox. `
          + `Your name is ${state.player?.name || 'The Traveler'}, and your story is about to unfold.`
        );
        setShowAwakening(true);
      }
    };

    triggerAwakening();

    // Cleanup: mark unmount and abort pending synthesis
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [state?.player?.name, state?.needsCharacterCreation, isAwakeningComplete, showAwakening, state?.metadata?.name, state?.paradoxLevel]);

  // SAFETY VALVE: Auto-clear overlays if they persist beyond expected time
  // This prevents deadlock if awakening or character creation UI gets stuck
  useEffect(() => {
    // Track how long needsCharacterCreation has been true
    const checkOverlayTimeout = setTimeout(() => {
      if (state?.needsCharacterCreation && !state?.player) {
        console.warn('[BetaApp] SAFETY: Character creation UI persisted >15s, forcing clear');
        setState(prev => ({
          ...prev,
          needsCharacterCreation: false
        }));
      }

      // Track how long showAwakening has been true without being complete
      if (showAwakening && !isAwakeningComplete) {
        console.warn('[BetaApp] SAFETY: Awakening UI persisted >15s, forcing clear');
        setShowAwakening(false);
        setIsAwakeningComplete(true);
      }
    }, 15000); // 15 second safety threshold

    return () => clearTimeout(checkOverlayTimeout);
  }, [state?.needsCharacterCreation, showAwakening, isAwakeningComplete, state?.player]);


  // M41 Task 5: Epoch-based theme morphing [M48-A4: Disabled - epochId not in WorldState]
  // useEffect(() => {
  //   if (!state?.epochId) return;
  //
  //   // Apply theme based on current epoch (1, 2, or 3)
  //   // Extract epoch number from string like "epoch_i_fracture"
  //   const epochMatch = state.epochId.match(/epoch_([iv]+)_/);
  //   if (epochMatch) {
  //     const romanNumeral = epochMatch[1].toLowerCase();
  //     const epochMap: Record<string, 1 | 2 | 3> = { 'i': 1, 'ii': 2, 'iii': 3 };
  //     const epoch = epochMap[romanNumeral];
  //     if (epoch) {
  //       themeManager.applyTheme(epoch, true);
  //     }
  //   }
  // }, [state?.epochId]); // Re-run whenever epoch changes

  // M42 Task 1: Subscribe to remote epoch shifts from P2P network [M48-A4: Disabled - references disabled themeManager]
  // useEffect(() => {
  //   const epochSyncEngine = getEpochSyncEngine();
  //
  //   // Subscribe to epoch shift events (both local and remote)
  //   const unsubscribe = epochSyncEngine.subscribeToEpochShifts((event) => {
  //     try {
  //       // Apply theme morphing on remote shift
  //       if (event.targetEpoch >= 1 && event.targetEpoch <= 3) {
  //         console.log(`[BetaApp] Applying epoch shift to ${event.targetEpoch} from ${event.source}`);
  //         themeManager.applyTheme(event.targetEpoch, true);
  //       }
  //
  //       // Record sync timing for telemetry
  //       const syncLatency = Date.now() - event.timestamp;
  //       if (syncLatency > 100) {
  //         console.warn(`[BetaApp] Slow epoch sync: ${syncLatency}ms latency (target: <100ms)`);
  //       }
  //     } catch (error) {
  //       console.error('[BetaApp] Error processing epoch shift:', error);
  //     }
  //   });
  //
  //   return () => unsubscribe();
  // }, []); // Effect runs once on mount

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

  // M42 Task 2: Cinematic Transition Overlay Wiring [M48-A4: Disabled - references undefined epochId]
  // useEffect(() => {
  //   if (!state?.epochId) return;
  //
  //   // Detect epoch shift and trigger transition overlay
  //   if (lastEpochId !== undefined && state.epochId !== lastEpochId) {
  //     console.log(`[BetaApp] Epoch shifted: ${lastEpochId} → ${state.epochId}`);
  //     transitionEngine.startWorldTransition('epoch_shift', 800);
  //   }
  //   setLastEpochId(state.epochId);
  // }, [state?.epochId, lastEpochId]);

  // M42 Task 3: Macro Event Transition Trigger
  useEffect(() => {
    if (!macroEventDiagnostics) return;

    // Trigger "world rebuild" glitch effect on catastrophic event
    if (macroEventDiagnostics.avgSeverity > 80 && macroEventDiagnostics.activeCount > 0) {
      console.log('[BetaApp] Macro event catastrophe detected - triggering transition');
      transitionEngine.startWorldTransition('paradox', 800);
    }
  }, [macroEventDiagnostics?.avgSeverity, macroEventDiagnostics?.activeCount]);

  // M42 Phase 4 Task 2: Live Ops Event Scheduler [M48-A4: Disabled - references undefined state properties]
  // useEffect(() => {
  //   if (!state || state.tick === undefined) return;
  //
  //   // Process scheduled events for this tick
  //   const firedEvents = liveOpsEngine.processTick(state.tick);
  //
  //   if (firedEvents.length > 0) {
  //     // Add fired events to state.macroEvents
  //     if (!state.macroEvents) {
  //       state.macroEvents = [];
  //     }
  //
  //     firedEvents.forEach(fired => {
  //       const macroEvent = {
  //         id: fired.eventId,
  //         name: fired.eventName,
  //         category: fired.category,
  //         fireAt: state.tick,
  //         severity: fired.severity,
  //         description: fired.description,
  //         active: true,
  //         icon: fired.icon,
  //         factionImpact: fired.factionImpact,
  //         triggeredBy: 'LIVEOPS_SCHEDULER',
  //         timestamp: Date.now()
  //       };
  //
  //       state.macroEvents.push(macroEvent);
  //       console.log(`[BetaApp] Live Ops event fired: ${fired.eventName} (${fired.scheduleId})`);
  //
  //       // Trigger transition if catastrophic
  //       if (fired.category.includes('catastrophe') || fired.category.includes('apocalypse')) {
  //         transitionEngine.startWorldTransition('epoch_shift', 800);
  //       }
  //     });
  //
  //     // Force state update to reflect new events
  //     setState({ ...state });
  //   }
  // }, [state?.tick]);

  // M42 Task 5: Tier 2 Milestone Detection (Diplomat & Weaver) [M48-A4: Disabled - references disabled functions]
  // Tier 2 Milestone Detection (Diplomat & Weaver)
  useEffect(() => {
    if (!state) return;

    // Check for Diplomat milestone (faction influence)
    const hasRecentFactionInfluence = state.factions?.some((f: any) =>
      f.recentInfluencers?.includes(state.player?.id) && 
      (f.consensusShiftedAt ?? 0) > Date.now() - 5000 // Within last 5 seconds
    );

    if (hasRecentFactionInfluence && !tutorialState.milestones.diplomat.achieved) {
      console.log('[BetaApp] Diplomat milestone detected');
      const updated = triggerDiplomatMilestone(tutorialState, 'faction_0', state.tick || 0);
      setTutorialState(updated);
      setCurrentTutorialOverlay(getNextTutorialOverlay(updated));
    }

    // Check for Weaver milestone (3+ participant grand ritual)
    const hasGrandRitual = state.activeEvents?.some((e: any) =>
      e.type === 'grand_ritual' &&
      e.participants &&
      Array.isArray(e.participants) &&
      e.participants.length >= 3 &&
      e.participants.includes(state.player?.id)
    );

    if (hasGrandRitual && !tutorialState.milestones.weaver.achieved) {
      console.log('[BetaApp] Weaver milestone detected');
      const grandRitual = state.activeEvents?.find((e: any) => e.type === 'grand_ritual' && e.participants?.length >= 3 && e.participants?.includes(state.player?.id)) as any;
      const participantCount = grandRitual?.participants?.length || 0;
      const updated = triggerWeaverMilestone(tutorialState, participantCount, state.tick || 0);
      setTutorialState(updated);
      setCurrentTutorialOverlay(getNextTutorialOverlay(updated));
    }
  }, [state?.factions, state?.activeEvents, state?.player?.id, tutorialState]);

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

  // Phase 30 Task 4: Subscribe to AIService Processing Events
  // TODO: Re-enable when AIService supports event emission
  /*
  useEffect(() => {
    const subscribeToAIService = async () => {
      try {
        const aiService = (await import('../services/AIService')).getAIService?.();
        if (!aiService) return;

        // Listen for synthesis start event
        if (aiService.on) {
          aiService.on('synthesisStart', (synthesisType: string) => {
            setWeaverProcessing({
              isProcessing: true,
              latencyMs: 0,
              synthesisType,
              progress: 0
            });
          });

          // Listen for progress updates
          aiService.on('synthesisProgress', (progress: number, latencyMs: number) => {
            setWeaverProcessing((prev) =>
              prev
                ? { ...prev, progress, latencyMs }
                : null
            );
          });

          // Listen for synthesis complete
          aiService.on('synthesisComplete', (result: any) => {
            setWeaverProcessing((prev) =>
              prev
                ? {
                    ...prev,
                    latencyMs: result.latency,
                    isProcessing: false
                  }
                : null
            );
            // Clear after 1 second for visual feedback
            setTimeout(() => setWeaverProcessing(null), 1000);
          });

          // Listen for synthesis error
          aiService.on('synthesisError', (error: string) => {
            console.warn('[BetaApp] AI Synthesis error:', error);
            setWeaverProcessing(null);
          });
        }
      } catch (error) {
        console.warn('[BetaApp] Failed to subscribe to AIService:', error);
      }
    };

    subscribeToAIService();
  }, []);
  */

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
        epoch: undefined, // [M48-A4: epochId not in WorldState]
        player: state.player ? {
          // name: state.player.name, // [M48-A4: Disabled - not on PlayerState]
          // level: state.player.level, // [M48-A4: Disabled]
          // hp: state.player.hp, // [M48-A4: Disabled]
          // maxHp: state.player.maxHp, // [M48-A4: Disabled]
          location: state.player.location,
          // xp: state.player.xp, // [M48-A4: Disabled]
          // gold: state.player.gold, // [M48-A4: Disabled]
          // temporalDebt: state.player.temporalDebt, // [M48-A4: Disabled]
          // soulStrain: state.player.soulStrain, // [M48-A4: Disabled]
          inventory_count: state.player.inventory?.length || 0
        } : null,
        npcs_count: state.npcs?.length || 0,
        quests_count: state.quests?.length || 0,
        activeEvents_count: state.activeEvents?.length || 0
      },
      // tutorialState: tutorialState, // [M48-A4: Disabled]
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
  }, [state]); // [M48-A4: Removed tutorialState from deps]

  const performAction = useCallback((actionRequest: any) => {
    if (!controller) {
      console.error('[BetaApp] performAction called but controller is null!');
      return;
    }

    const action = {
      ...actionRequest,
      worldId: state.id,
      worldInstanceId: state.id,
      playerId: state.player?.id || 'player_0',
      clientId
    };

    console.log('[BetaApp] performAction dispatching:', {
      type: action.type,
      hasCharacter: !!action.payload?.character?.name,
      characterName: action.payload?.character?.name,
      controllerExists: !!controller
    });
    
    try {
      controller.performAction(action);
      console.log('[BetaApp] performAction completed successfully');
    } catch (error) {
      console.error('[BetaApp] performAction failed:', error);
    }
    
    // Check controller state immediately after action
    setTimeout(() => {
      const controllerState = controller.getState?.();
      console.log('[BetaApp] Controller state after performAction:', {
        needsCharacterCreation: controllerState?.needsCharacterCreation,
        playerName: controllerState?.player?.name,
        hasPlayer: !!controllerState?.player
      });
    }, 100);
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
      setActiveTrade(result.trade);
      setShowTradeUI(true);

      // Subscribe to trade updates
      tradeManager.subscribe(result.trade.tradeId, (updatedTrade) => {
        setActiveTrade(updatedTrade);
        
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

  // =========================================================================
  // RENDER: MAIN LAYOUT  
  // =========================================================================

  if (!state || !controller) {
    return <DiegeticLoadingOverlay visible={true} />;
  }

  // Phase 48-UI: Fixed viewport, no-scroll wrapper
  const GameViewportStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    background: '#050510',
    zIndex: 1,
  };

  return (
    <div style={GameViewportStyle}>
      {/* Phase 48-UI: Diegetic Loading Overlay */}
      <DiegeticLoadingOverlay visible={!state || !controller} />

      {/* Character Creation Modal */}
      {state?.needsCharacterCreation && (
        <CharacterCreationOverlay
          worldTemplate={buildCharacterCreationWorldTemplate(state?.metadata, state?.locations)}
          onCharacterCreated={(character) => {
            console.log('[BetaApp] onCharacterCreated called with:', character.name);
            if (controller) {
              console.log('[BetaApp] Calling performAction with SUBMIT_CHARACTER for:', character.name);
              performAction({
                type: 'SUBMIT_CHARACTER',
                payload: { character }
              });
              console.log('[BetaApp] performAction call completed');

              // Fallback: Force local state update immediately since socket is disabled
              console.warn('[BetaApp] Socket disabled - forcing immediate local character entry');
              setTimeout(() => {
                console.log('[BetaApp] Applying local fallback for character creation');
                setState(prevState => {
                  // Compute HP from character stats if available (Phase 7 fix)
                  const stats = character.baseStats || character.stats;
                  const con = stats?.CON ?? stats?.end ?? 10;
                  const wis = stats?.WIS ?? stats?.int ?? 10;
                  const computedMaxHp = 20 + (con * 2) + Math.floor(wis / 3);
                  const existingHp = prevState?.player?.hp;
                  const existingMaxHp = prevState?.player?.maxHp;

                  const newState = {
                    ...prevState,
                    player: {
                      ...prevState?.player,   // Preserve existing player fields (hp, maxHp, gold, etc.)
                      ...character,            // Overlay character creation data
                      id: character.id || 'player_0',
                      ancestryTree: character.ancestryTree || [],
                      // Ensure HP is never lost — use computed, then existing, then default
                      hp: character.hp ?? existingHp ?? computedMaxHp,
                      maxHp: character.maxHp ?? existingMaxHp ?? computedMaxHp,
                      // Phase 8: Ensure MP and Grit are also hydrated
                      mp: character.mp ?? prevState?.player?.mp ?? (character.maxMp || (50 + ((stats?.INT ?? 10) * 5) + ((stats?.CHA ?? 10) * 2))),
                      maxMp: character.maxMp ?? prevState?.player?.maxMp ?? (50 + ((stats?.INT ?? 10) * 5) + ((stats?.CHA ?? 10) * 2)),
                      grit: character.grit ?? prevState?.player?.grit ?? (character.maxGrit || (30 + (con * 2) + Math.floor(wis * 1.5))),
                      maxGrit: character.maxGrit ?? prevState?.player?.maxGrit ?? (30 + (con * 2) + Math.floor(wis * 1.5)),
                    },
                    needsCharacterCreation: false
                  };
                  console.log('[BetaApp] Local state update applied:', {
                    needsCharacterCreation: newState.needsCharacterCreation,
                    playerName: newState.player?.name
                  });
                  return newState;
                });
              }, 500);
            } else {
              console.log('[BetaApp] Controller not available!');
            }
          }}
        />
      )}

      {/* Awakening Cinematic */}
      {showAwakening && originStory && (
        <CinematicTextOverlay
          text={originStory}
          characterName={state?.player?.name || 'The Traveler'}
          weaverProcessing={weaverProcessing}
          paradoxLevel={state?.paradoxLevel ?? 0}
          title="The Awakening"
          textSpeed={30}
          onContinue={() => {
            setShowAwakening(false);
            setIsAwakeningComplete(true);
            console.log('[BetaApp] Awakening sequence complete, proceeding to active game');
          }}
        />
      )}

      {/* Tutorial Overlay */}
      {currentTutorialOverlay && (
        <TutorialOverlay
          appState={{ player: { tutorialState }, paradoxLevel: state?.paradoxLevel ?? 0 }}
          onDismiss={(milestoneId) => {
            const updated = dismissTutorialOverlay(tutorialState, milestoneId as any);
            setTutorialState(updated);
            setCurrentTutorialOverlay(getNextTutorialOverlay(updated));
            console.log('[BetaApp] Tutorial milestone dismissed:', milestoneId);
          }}
        />
      )}

      {/* Narrative Intervention Overlay */}
      {activeWhisper && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            filter: `brightness(${1 - (activeWhisper.intensity / 100) * 0.2}) blur(${(activeWhisper.intensity / 100) * 2}px)`,
            zIndex: 9996,
            pointerEvents: 'none',
            transition: 'filter 0.4s ease-in-out'
          }}
          aria-hidden="true"
        />
      )}
      <NarrativeInterventionOverlay
        whisperQueue={activeWhisper ? [{ 
          id: activeWhisper.id, 
          fromDirector: activeWhisper.source,
          message: activeWhisper.message,
          timestamp: activeWhisper.timestamp,
          duration: activeWhisper.durationMs,
          priority: activeWhisper.intensity >= 75 ? 'critical' : activeWhisper.intensity >= 50 ? 'urgent' : 'normal',
          isCanonical: true
        }] : []}
        onWhisperComplete={(id) => dismissWhisper(id)}
        currentEpoch={1}
        playerName={state?.player?.name}
        enableAudio={true}
      />

      {/* Phase 48-UI: Main game layout using TabletopContainer grid */}
      <TabletopContainer worldState={state} hideParticleSurface={true} controller={controller}>
        {/* The TabletopContainer now handles the 3-column grid layout */}
        <GlobalErrorBoundary>
          <AtmosphericFilterProvider state={state}>
            {/* Game board content - rendered in center of 3-column grid */}
            <GameStage worldState={state} controller={controller} />
          </AtmosphericFilterProvider>
        </GlobalErrorBoundary>
      </TabletopContainer>

      {/* Director Mode Modal */}
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
          }}
          open
        >
          <div
            style={{
              backgroundColor: '#1a1a2e',
              border: '2px solid #c084fc',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              color: '#e0e0e0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: '#c084fc', margin: 0 }}>Director Mode</h2>
              <button
                onClick={() => setIsDirector(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #c084fc',
                  color: '#c084fc',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
            <p style={{ color: '#999', fontSize: '12px' }}>Director Dashboard - Manage world events and narrative flow.</p>
            <CoDmDashboard
              currentDirectorState={{
                chaos: 50,
                paradox: state?.paradoxLevel ?? 50,
                prophecyHealth: 75
              }}
            />
          </div>
        </dialog>
      )}

      {/* Phase 34: Footer — toasts, autosave indicator, shortcut legend */}
      <GameFooter worldState={state} />
    </div>
  );
};

const FALLBACK_GLOBAL_CONSTANTS: any = {
  tickDuration: 1.5,
  ticksPerDay: 57600,
  ticksPerEpoch: 1440000,
  maxConcurrentPlayers: 32,
  initialParadoxDebt: 0,
  initialStability: 0.65,
  snapshotIntervalTicks: 600,
  maxArtifactsPerWorld: 500,
  tileSize: 2,
  gravityScale: 1.0,
  manaSaturation: 0.5,
  resourceGenerationMultiplier: 1.0,
  factionActionBudgetPerDay: 100,
  securityPatches: []
};

function buildCharacterCreationWorldTemplate(metadata?: any, worldLocations?: any[]): any {
  const tags: string[] = Array.isArray(metadata?.tags) ? metadata.tags : [];
  const loreHighlights: string[] = Array.isArray(metadata?.loreHighlights)
    ? metadata.loreHighlights
    : [
        'Paradox currents twist through Luxfier Alpha.',
        'Matriarchal echoes guide the awakening travelers.',
        'Ancient spires hold the secrets of the lineage.'
      ];

  const baseMetadata = {
    name: metadata?.name || 'Luxfier Alpha',
    description: metadata?.description || 'A prototype reality seeded from the Luxfier registry.',
    worldEpoch: metadata?.worldEpoch || 'epoch_i_awakening',
    createdAt: metadata?.createdAt || new Date().toISOString(),
    version: metadata?.version ?? 1,
    author: metadata?.author ?? 'Luxfier Labs',
    tags,
    loreHighlights
  };

  return {
    templateId: metadata?.templateId || 'luxfier-alpha-fallback',
    metadata: baseMetadata,
    globalConstants: metadata?.globalConstants ? { ...metadata.globalConstants } : { ...FALLBACK_GLOBAL_CONSTANTS },
    factionalSeed: metadata?.factionalSeed || { factions: [], relationships: [] },
    ancestryTrees: metadata?.ancestryTrees || [],
    ancestryAvailability: metadata?.ancestryAvailability || [],
    talentPool: metadata?.talentPool || [],
    divinePresence: metadata?.divinePresence || [],
    economicModel: metadata?.economicModel || 'prototype',
    securityPatches: metadata?.securityPatches || [],
    startingLocations: (worldLocations && worldLocations.length > 0)
      ? worldLocations
      : (metadata?.startingLocations || metadata?.locations || [
        {
          id: 'fallback-outpost',
          name: 'Fallback Outpost',
          description: 'A transit point the Beta shell creates when the template is missing.',
          loreContext: 'Neutral ground that safely anchors new travelers in the summit of Luxfier.'
        }
      ]),
    startingGearChoices: metadata?.startingGearChoices || [],
    curiosityPool: metadata?.curiosityPool || []
  };
}

export default BetaApplication;
