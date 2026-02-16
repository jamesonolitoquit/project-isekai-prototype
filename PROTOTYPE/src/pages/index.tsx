import React, { useEffect, useState, useMemo } from "react";
import { createWorldController, createInitialWorld } from "../engine/public";
import BetaApplication from "../client/components/BetaApplication";
import SeasonPanel from "../client/components/SeasonPanel";
import WeatherPanel from "../client/components/WeatherPanel";
import QuestPanel from "../client/components/QuestPanel";
import DialogPanel from "../client/components/DialogPanel";
import ParticleVisualizer from "../client/components/ParticleVisualizer";
import AudioVisualizer from "../client/components/AudioVisualizer";
import { getEventsForWorld } from "../engine/public";
import PlayerState from "../client/components/PlayerState";
import CombatLog from "../client/components/CombatLog";
import InventoryPanel from "../client/components/InventoryPanel";
import LevelUpModal from "../client/components/LevelUpModal";
import CraftingModal from "../client/components/CraftingModal";
import CombatArena from "../client/components/CombatArena";
import TemplatePanel from "../client/dev/TemplatePanel";
import SchemaForm from "../client/dev/SchemaForm";
import CharacterCreation from "../client/components/CharacterCreation";
import * as localBackups from "../client/dev/localBackups";
import sampleTpl from '../data/luxfier-world.json';
import tplSchema from '../data/luxfier-world.schema.json';
import FactionPanel from "../client/components/FactionPanel";
import { ArtifactForge } from "../client/components/ArtifactForge";
import MorphingStation from "../client/components/MorphingStation";
import ParadoxIndicator from "../client/components/ParadoxIndicator";
import TravelProgress from "../client/components/TravelProgress";
import Codex from "../client/components/Codex";
import GlobalHeader from "../client/components/GlobalHeader";
import DiceAltar from "../client/components/DiceAltar";
import LegacyOracle from "../client/dev/LegacyOracle";
import ChronicleArchive from "../client/components/ChronicleArchive";
import ChronicleScroll from "../client/components/ChronicleScroll";

export default function HomePage() {
  const [useBetaUI, setUseBetaUI] = useState(false);
  const [devDockOpen, setDevDockOpen] = useState(false);
  const [controller, setController] = useState<any | null>(null);
  const [state, setState] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isDevMode, setIsDevMode] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showLevelUPModal, setShowLevelUpModal] = useState(false);
  const [showCraftingModal, setShowCraftingModal] = useState(false);
  const [showChronicleArchive, setShowChronicleArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<'world' | 'combat' | 'politics' | 'arcane' | 'codex'>('world');
  
  // BETA: DiceAltar state management
  const [showDiceAltar, setShowDiceAltar] = useState(false);
  const [diceRollContext, setDiceRollContext] = useState<any | null>(null);
  const [pendingAction, setPendingAction] = useState<any | null>(null);

  // useEffect(() => {
  //   const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');
  //   const c = createWorldController(undefined, isDev);
  //   setController(c);
  //   let unsub: any = null;
  //   let pollId: any = null;
  //   if ((c as any).subscribe) {
  //     unsub = (c as any).subscribe((s: any) => setState(s));
  //   } else {
  //     // Poll for state updates when subscribe is not available
  //     pollId = setInterval(() => {
  //       try { setState((c as any).getState()); } catch (e) {}
  //     }, 200);
  //   }
  //   if ((c as any).start) (c as any).start();
  //   setEvents([]);
  //   return () => {
  //     try { if (unsub) unsub(); } catch (e) {}
  //     try { if (pollId) clearInterval(pollId); } catch (e) {}
  //     try { if ((c as any).stop) (c as any).stop(); } catch (e) {}
  //   };
  // }, []);

  useEffect(() => {
    setIsDevMode(process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'));
  }, []);

  const loadTemplateIntoController = (tpl: any) => {
    // stop existing controller and create a new one from the provided template
    if (controller) {
      try { if ((controller as any).stop) (controller as any).stop(); } catch (e) {}
    }
    // create initial state from template and instantiate a controller with it
    const initial = createInitialWorld(`world-${Date.now()}`, tpl);
    const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');
    const c = createWorldController(initial, isDev);
    setController(c);
    if ((c as any).subscribe) {
      const unsub = (c as any).subscribe((s: any) => setState(s));
    } else {
      // start a poll for state updates
      const id = setInterval(() => { try { setState((c as any).getState()); } catch (e) {} }, 200);
      // clear when switching templates
      setTimeout(() => clearInterval(id), 0);
    }
    if ((c as any).start) (c as any).start();
    setEvents([]);
    // ensure we clean up previous subscription when next load happens
    // (we rely on component unmount cleanup to stop the controller)
  };

  // Inline lightweight TemplateEditor (avoids external module resolution issues)
  const [editorTab, setEditorTab] = useState<'edit'|'json'|'backups'>('edit');
  const [editorWorking, setEditorWorking] = useState<any>(sampleTpl);
  const [editorJson, setEditorJson] = useState<string>(JSON.stringify(sampleTpl, null, 2));
  const [editorBackups, setEditorBackups] = useState(localBackups.listBackups());
  const editorExtra = useMemo(() => ({ locations: editorWorking?.locations || [], quests: editorWorking?.quests || [] }), [editorWorking]);

  useEffect(() => {
    if (!controller) return;
    const id = setInterval(() => {
      setEvents(getEventsForWorld(controller.getState().id));
    }, 500);
    return () => clearInterval(id);
  }, [controller]);

  // BETA: Listen for DICE_ROLL_REQUEST events to trigger DiceAltar modal
  useEffect(() => {
    if (!controller) return;
    const checkForDiceRollRequest = () => {
      const allEvents = getEventsForWorld(controller.getState().id);
      const diceRollEvent = allEvents.find((e: any) => e.type === 'DICE_ROLL_REQUEST');
      
      if (diceRollEvent && !showDiceAltar) {
        const { diceContext, actionType, actionPayload } = diceRollEvent.payload || {};
        setDiceRollContext(diceContext);
        setPendingAction({ type: actionType, payload: actionPayload });
        setShowDiceAltar(true);
        setActiveTab('combat'); // Switch to combat tab when dice is shown
      }
    };
    
    const pollId = setInterval(checkForDiceRollRequest, 200);
    return () => clearInterval(pollId);
  }, [controller, showDiceAltar]);

  // Wire audio controller for soundscape transitions
  // useAudioController(
  //   state?.player?.location,
  //   state?.weather,
  //   state?.metadata?.audioVolume ?? 0.8
  // );

  const doMove = (to: string) => {
    if (!controller) return;
    controller.performAction({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: "MOVE", payload: { to } });
  };

  const doInteract = (npcId: string) => {
    if (!controller) return;
    controller.performAction({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: "INTERACT_NPC", payload: { npcId } });
  };

  const doDialogChoice = (npcId: string, choiceId: string) => {
    if (!controller) return;
    // Find the NPC definition and possible choice effects
    const npc = controller.getState().npcs.find((n: any) => n.id === npcId);
    // locate the most recent dialogue definition for this NPC's current index
    const idx = (controller.getState().player.npcDialogueIndex && controller.getState().player.npcDialogueIndex[npcId]) || 0;
    const raw = (npc.dialogue && npc.dialogue[idx - 1]) || npc.dialogue && npc.dialogue[0];
    const choice = raw && typeof raw === 'object' && raw.choices ? raw.choices.find((c: any) => c.id === choiceId) : undefined;
    const payload: any = { npcId, choiceId };
    if (choice && choice.startQuest) payload.startQuest = choice.startQuest;
    controller.performAction({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: 'DIALOG_CHOICE', payload });
  };

  const doStartQuest = (questId: string) => {
    if (!controller) return;
    controller.performAction({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: "START_QUEST", payload: { questId } });
  };

  const doCompleteQuest = (questId: string) => {
    if (!controller) return;
    controller.performAction({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: "COMPLETE_QUEST", payload: { questId } });
  };

  const doSubmitCharacter = (character: any) => {
    if (!controller) return;
    // Pass full character object including ID for deterministic persistence
    controller.performAction({
      worldId: controller.getState().id,
      playerId: character.id || controller.getState().player.id,
      type: "SUBMIT_CHARACTER",
      payload: { character }
    });
  };

  const doAttack = (npcId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "ATTACK",
      payload: { targetId: npcId }
    });
  };

  const doDefend = (npcId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "DEFEND",
      payload: { targetId: npcId }
    });
  };

  const doParry = (npcId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "PARRY",
      payload: { targetId: npcId }
    });
  };

  const doHeal = () => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "HEAL",
      payload: {}
    });
  };

  const doExitCombat = () => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "EXIT_COMBAT",
      payload: {}
    });
  };

  const doCastSpell = (spellId: string, targetId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "CAST_SPELL",
      payload: { spellId, targetId }
    });
  };

  const doDrainMana = (locationId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "DRAIN_MANA",
      payload: { locationId }
    });
  };

  const doRest = () => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "REST",
      payload: {}
    });
  };

  const doPickupItem = (itemId: string, quantity: number) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "PICKUP_ITEM",
      payload: { itemId, quantity }
    });
  };

  const doDropItem = (itemId: string, quantity: number) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "DROP_ITEM",
      payload: { itemId, quantity }
    });
  };

  const doEquipItem = (itemId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "EQUIP_ITEM",
      payload: { itemId }
    });
  };

  const doUseItem = (itemId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "USE_ITEM",
      payload: { itemId }
    });
  };

  const doAllocateStat = (stat: string, amount: number) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "ALLOCATE_STAT",
      payload: { stat, amount }
    });
  };

  const doCraft = (recipeId: string) => {
    if (!controller) return;
    controller.performAction({
      worldId: controller.getState().id,
      playerId: controller.getState().player.id,
      type: "CRAFT_ITEM",
      payload: { recipeId }
    });
    setShowCraftingModal(false);
  };

  const doSave = () => controller?.save();
  const doLoad = () => controller?.load();

  // BETA: Handle DiceAltar resolution
  const handleDiceRollResolved = (success: boolean, roll: number, totalValue: number) => {
    if (!controller || !pendingAction) return;
    
    // Replay action with diceRollConfirmed flag and roll results
    const confirmedAction = {
      ...pendingAction,
      payload: {
        ...pendingAction.payload,
        diceRollConfirmed: true,
        diceRollResult: { success, roll, totalValue }
      }
    };
    
    // Insert action context
    confirmedAction.worldId = controller.getState().id;
    confirmedAction.playerId = controller.getState().player.id;
    
    // Perform the confirmed action
    controller.performAction(confirmedAction);
    
    // Clean up DiceAltar UI
    setShowDiceAltar(false);
    setDiceRollContext(null);
    setPendingAction(null);
  };

  const npcsHere = (state?.npcs || []).filter((n: any) => n.locationId === state?.player?.location);
  const questStatus = state?.player?.quests?.["winter-festival"]?.status || "not_started";

  // Action wrapper to update tab and perform action
  const performActionWithFeedback = (actionRequest: any) => {
    if (actionRequest.type === 'ATTACK' || actionRequest.type === 'DEFEND' || actionRequest.type === 'PARRY') {
      setActiveTab('combat');
    }
    controller?.performAction(actionRequest);
  };

  // BETA: Generate epoch-based visual filters (GPU-optimized)
  const getEpochFilters = (): string => {
    const theme = state?.epochMetadata?.theme;
    if (!theme) return '';
    
    // Use only GPU-efficient filters to maintain 60fps
    if (theme === 'Waning') {
      // Desaturated, warm sepia tones for decline era
      // Optimized: sepia is more efficient than separate saturation+hue
      return 'saturate(0.7) sepia(0.2) brightness(1.0)';
    } else if (theme === 'Twilight') {
      // High contrast monochrome with blue tint
      // Optimized: reduced invert amount for better performance
      return 'saturate(0.35) brightness(0.92) contrast(1.08)';
    }
    // Fracture: vibrant, normal colors
    return 'saturate(1.1) brightness(1.0)';
  };

  return (
    <div 
      className="app-root omni-hud"
      style={{
        filter: getEpochFilters(),
        transition: 'filter 0.8s ease-in-out',
        willChange: 'filter',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        WebkitPerspective: 1000,
        perspective: 1000
      }}
    >
      {/* Global Paradox Indicator Overlay */}
      {state && <ParadoxIndicator state={state} />}

      {/* Global Travel Progress Overlay */}
      {state && <TravelProgress state={state} />}

      {/* M38 TASK 1: BETA UI TOGGLE */}
      {!state?.needsCharacterCreation && (
        <button
          onClick={() => setUseBetaUI(!useBetaUI)}
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 999,
            padding: '8px 16px',
            backgroundColor: useBetaUI ? '#00cc00' : '#4f2783',
            color: useBetaUI ? '#000' : '#c084fc',
            border: `2px solid ${useBetaUI ? '#00ff00' : '#c084fc'}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {useBetaUI ? '✓ BETA UI' : 'BETA UI'}
        </button>
      )}

      {/* M38 TASK 1: BETA APPLICATION - Unified UI for M35-M37 Integration */}
      {useBetaUI && state && controller && !state?.needsCharacterCreation && (
        <BetaApplication
          initialState={state}
          controller={controller}
          isMultiplayer={false}
          clientId="client_0"
          showDevTools={isDevMode}
        />
      )}

      {/* BETA: DiceAltar Modal for action resolution */}
      {!useBetaUI && showDiceAltar && diceRollContext && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <DiceAltar
            context={diceRollContext}
            onResolved={handleDiceRollResolved}
          />
        </div>
      )}

      {/* Global Persistent HUD Header */}
      {!useBetaUI && state && !state.needsCharacterCreation && <GlobalHeader state={state} />}

      <div className="main-shell" style={{ display: useBetaUI ? 'none' : 'block' }}>
        {state?.needsCharacterCreation ? (
          <div className="gameplay-area character-creation-overlay">
            <CharacterCreation onCharacterCreated={doSubmitCharacter} startingLocation={state?.player?.location} />
          </div>
        ) : (
          <div className="gameplay-area tabbed-layout">
            {/* Tab Navigation Bar */}
            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'world' ? 'active' : ''}`}
                onClick={() => setActiveTab('world')}
              >
                🌍 World
              </button>
              <button
                className={`tab-btn ${activeTab === 'combat' ? 'active' : ''}`}
                onClick={() => setActiveTab('combat')}
              >
                ⚔️ Combat
              </button>
              <button
                className={`tab-btn ${activeTab === 'politics' ? 'active' : ''}`}
                onClick={() => setActiveTab('politics')}
              >
                👑 Politics
              </button>
              <button
                className={`tab-btn ${activeTab === 'arcane' ? 'active' : ''}`}
                onClick={() => setActiveTab('arcane')}
              >
                ✨ Arcane
              </button>
              <button
                className={`tab-btn ${activeTab === 'codex' ? 'active' : ''}`}
                onClick={() => setActiveTab('codex')}
              >
                📖 Codex
              </button>
              <button
                style={{
                  marginLeft: 'auto',
                  background: showChronicleArchive ? '#d4af37' : '#74b9ff',
                  color: showChronicleArchive ? '#000' : '#fff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={() => setShowChronicleArchive(!showChronicleArchive)}
              >
                📜 Hall of Legends
              </button>
            </div>

            {/* Tab Content Area */}
            <div className="tab-content-area">
              {/* WORLD TAB */}
              {activeTab === 'world' && (
                <div className="tab-content world-tab">
                  <div className="world-left-column">
                    <SeasonPanel state={state} />
                    <WeatherPanel state={state} />
                    <div className="panel">
                      <div><strong>Location:</strong> {state?.player?.location}</div>
                      <div style={{ marginTop: 8 }}>
                        <strong>NPCs here:</strong>
                        <ul>
                          {npcsHere.length === 0 && <li>None</li>}
                          {npcsHere.map((n: any) => {
                            const curHour = state?.time?.hour ?? state?.hour ?? 0;
                            const avail = n.availability;
                            let isAvailable = true;
                            if (avail && (typeof avail.startHour === 'number' || typeof avail.endHour === 'number')) {
                              const s = avail.startHour ?? 0;
                              const e = avail.endHour ?? 24;
                              if (s < e) isAvailable = curHour >= s && curHour < e;
                              else isAvailable = curHour >= s || curHour < e;
                            }
                            const title = avail ? `Available ${String(avail.startHour).padStart(2, '0')}:00–${String(avail.endHour).padStart(2, '0')}:00` : undefined;
                            return (
                              <li key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 4, opacity: !isAvailable ? 0.4 : 1, flexWrap: 'wrap', gap: 4 }}>
                                <span title={title}>{n.name}{!isAvailable && ' (closed)'}</span>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  <button onClick={() => doInteract(n.id)} disabled={!isAvailable} style={{ fontSize: 12, padding: 4 }}>Talk</button>
                                  <button onClick={() => performActionWithFeedback({ worldId: controller.getState().id, playerId: controller.getState().player.id, type: 'ATTACK', payload: { targetId: n.id } })} disabled={!isAvailable} style={{ fontSize: 12, padding: 4, backgroundColor: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Attack</button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div style={{ marginTop: 8 }} className="controls">
                        <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button onClick={() => doHeal()} style={{ fontSize: 12, padding: 6, backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>🔮 Heal Self</button>
                          <button onClick={() => doRest()} style={{ fontSize: 12, padding: 6, backgroundColor: '#8956E7', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>😴 Rest 1h</button>
                        </div>
                        <div>
                          <strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Navigate:</strong>
                          {(state?.locations ?? []).map((loc: any) => (
                            <button
                              key={loc.id}
                              onClick={() => doMove(loc.id)}
                              disabled={state?.player?.location === loc.id}
                              style={{ marginRight: 6, marginBottom: 4, fontSize: 11, backgroundColor: '#4a90e2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: state?.player?.location === loc.id ? 0.5 : 1 }}
                            >
                              {loc.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="world-right-column">
                    <div className="dialog-primary">
                      <DialogPanel state={state} onChoose={doDialogChoice} />
                    </div>
                    <div className="context-panels">
                      <QuestPanel state={state} />
                      <PlayerState state={state} />
                      {showInventory && (
                        <div className="panel">
                          <InventoryPanel
                            state={state}
                            onPickupItem={doPickupItem}
                            onDropItem={doDropItem}
                            onEquipItem={doEquipItem}
                            onUseItem={doUseItem}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* COMBAT TAB */}
              {activeTab === 'combat' && (
                <div className="tab-content combat-tab">
                  <div className="combat-main">
                    <CombatArena
                      state={state}
                      onAttack={doAttack}
                      onDefend={doDefend}
                      onParry={doParry}
                      onHeal={doHeal}
                      onCastSpell={doCastSpell}
                      onExitCombat={doExitCombat}
                    />
                  </div>
                  <div className="combat-log-panel">
                    <h4>Combat Log</h4>
                    <CombatLog events={events} maxEntries={15} />
                  </div>
                </div>
              )}

              {/* POLITICS TAB */}
              {activeTab === 'politics' && (
                <div className="tab-content politics-tab">
                  <FactionPanel state={state} />
                </div>
              )}

              {/* ARCANE TAB */}
              {activeTab === 'arcane' && (
                <div className="tab-content arcane-tab">
                  <div className="arcane-split">
                    <div className="arcane-left">
                      <ArtifactForge state={state} onAction={performActionWithFeedback} />
                    </div>
                    <div className="arcane-right">
                      <MorphingStation state={state} onInitiateRitual={(targetRace) => performActionWithFeedback({ worldId: state.id, playerId: state.player.id, type: 'INITIATE_MORPH', payload: { targetRace } })} />
                    </div>
                  </div>
                </div>
              )}

              {/* CODEX TAB */}
              {activeTab === 'codex' && (
                <div className="tab-content codex-tab">
                  <Codex state={state} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`dev-dock ${devDockOpen ? 'open' : 'collapsed'}`}>
          {isDevMode && (
            <div className="dev-dock-inner">
              <TemplatePanel onLoad={loadTemplateIntoController} />
              <div style={{ border: '1px solid #666', padding: 10, marginTop: 8 }}>
                <h4>Dev: Template Editor</h4>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setEditorTab('edit')}>Edit</button>
                  <button onClick={() => setEditorTab('json')}>JSON</button>
                  <button onClick={() => setEditorTab('backups')}>Backups</button>
                </div>
                {editorTab === 'edit' && (
                  <div>
                    <SchemaForm schema={tplSchema} value={editorWorking} onChange={(v:any)=>setEditorWorking(v)} extraContext={editorExtra} />
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => { localBackups.saveBackup(editorWorking, 'manual'); setEditorBackups(localBackups.listBackups()); }}>Save Backup</button>
                      <button style={{ marginLeft: 8 }} onClick={() => loadTemplateIntoController(editorWorking)}>Load Into Controller</button>
                      <button style={{ marginLeft: 8 }} onClick={() => { setEditorJson(JSON.stringify(editorWorking, null, 2)); setEditorTab('json'); }}>Open JSON</button>
                    </div>
                  </div>
                )}
                {editorTab === 'json' && (
                  <div>
                    <textarea style={{ width: '100%', minHeight: 180 }} value={editorJson} onChange={(e)=>setEditorJson(e.target.value)} />
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => { try { const p = JSON.parse(editorJson); setEditorWorking(p); } catch (e) { /* noop */ } }}>Apply JSON</button>
                      <button style={{ marginLeft: 8 }} onClick={() => { const blob = new Blob([editorJson], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'template.json'; a.click(); URL.revokeObjectURL(url); }}>Export</button>
                    </div>
                  </div>
                )}
                {editorTab === 'backups' && (
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <button onClick={() => { localBackups.saveBackup(editorWorking, 'manual'); setEditorBackups(localBackups.listBackups()); }}>Create Backup</button>
                      <button style={{ marginLeft: 8 }} onClick={() => setEditorBackups(localBackups.listBackups())}>Refresh</button>
                    </div>
                    <div style={{ maxHeight: 200, overflow: 'auto' }}>
                      {editorBackups.map((b, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, borderBottom: '1px solid #eee' }}>
                          <div>
                            <div style={{ fontSize: 12 }}>{b}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { const d = localBackups.loadBackup(b); if (d) { setEditorWorking(d); setEditorJson(JSON.stringify(d, null,2)); setEditorTab('edit'); } }}>Load</button>
                            <button onClick={() => { localBackups.deleteBackup(b); setEditorBackups(localBackups.listBackups()); }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <h3>Event Log</h3>
                <div className="event-log" style={{ maxHeight: 520, overflow: "auto" }}>
                  {events.slice().reverse().slice(0,200).map((e: any) => {
                    const cls = `ev-${e.type}`;
                    const ts = new Date(e.timestamp).toLocaleTimeString();
                    return (
                      <div key={e.id} style={{ fontSize: 12, padding: 6 }} className={cls}>
                        <strong>[{ts}]</strong> <span style={{ marginLeft:8 }}>{e.type}</span>
                        <div style={{ opacity: 0.9, fontSize: 11 }}>{JSON.stringify(e.payload)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {isDevMode && controller && (
                <div style={{ marginTop: 12, borderTop: '1px dashed #444', paddingTop: 8 }}>
                  <h4>Dev Time Controls</h4>
                  <div style={{ marginBottom: 8 }}>
                    <div>Current: Day {controller.getState().time?.day ?? controller.getState().day}, {String(controller.getState().time?.hour ?? controller.getState().hour).padStart(2,'0')}:00 — {controller.getState().time?.season ?? controller.getState().season}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => controller.advanceTick(1)}>+1h</button>
                    <button onClick={() => controller.advanceTick(6)}>+6h</button>
                    <button onClick={() => controller.advanceTick(24)}>+24h</button>
                  </div>
                </div>
              )}
              
              {isDevMode && controller && (
                <div style={{ marginTop: 12, borderTop: '1px dashed #444', paddingTop: 8 }}>
                  <h4>Dev Cheat Menu</h4>
                  <div style={{ marginBottom: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
                    {/* HP Cheat */}
                    <label style={{ fontSize: 12 }}>Set HP:</label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      defaultValue={controller.getState().player?.hp ?? 100}
                      onChange={(e) => {
                        const newHp = Math.max(0, Math.min(999, parseInt(e.target.value) || 0));
                        const s = controller.getState();
                        s.player.hp = newHp;
                        controller.publishOptimisticState(s);
                      }}
                      style={{ padding: 4, fontSize: 12 }}
                    />
                    
                    {/* Mana Cheat */}
                    <label style={{ fontSize: 12 }}>Set Mana:</label>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      defaultValue={controller.getState().player?.mp ?? 100}
                      onChange={(e) => {
                        const newMp = Math.max(0, Math.min(999, parseInt(e.target.value) || 0));
                        const s = controller.getState();
                        s.player.mp = newMp;
                        controller.publishOptimisticState(s);
                      }}
                      style={{ padding: 4, fontSize: 12 }}
                    />
                    
                    {/* Soul Strain Cheat */}
                    <label style={{ fontSize: 12 }}>Soul Strain:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      defaultValue={controller.getState().player?.soulStrain ?? 0}
                      onChange={(e) => {
                        const strain = parseInt(e.target.value) || 0;
                        const s = controller.getState();
                        s.player.soulStrain = strain;
                        controller.publishOptimisticState(s);
                      }}
                      style={{ padding: 0 }}
                    />
                    {controller.getState().player?.soulStrain ?? 0}%
                    
                    {/* Paradox Cheat */}
                    <label style={{ fontSize: 12 }}>Paradox:</label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      defaultValue={controller.getState().paradox ?? 0}
                      onChange={(e) => {
                        const paradox = parseInt(e.target.value) || 0;
                        const s = controller.getState();
                        s.paradox = paradox;
                        controller.publishOptimisticState(s);
                      }}
                      style={{ padding: 0 }}
                    />
                    {controller.getState().paradox ?? 0}%
                  </div>
                  
                  {/* Faction Reputation Controls */}
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    <strong>Faction Rep:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 6 }}>
                      {(controller.getState().factions || []).map((faction: any) => (
                        <div key={faction.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 10, minWidth: 60 }}>{faction.name}:</span>
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={controller.getState().player?.factionReputation?.[faction.id] ?? 0}
                            onChange={(e) => {
                              const rep = parseInt(e.target.value) || 0;
                              const s = controller.getState();
                              if (!s.player) s.player = {};
                              if (!s.player.factionReputation) s.player.factionReputation = {};
                              s.player.factionReputation[faction.id] = rep;
                              controller.publishOptimisticState(s);
                            }}
                            style={{ flex: 1, padding: 0 }}
                          />
                          <span style={{ fontSize: 10, minWidth: 30 }}>{controller.getState().player?.factionReputation?.[faction.id] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Teleport Cheat */}
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 12 }}>Teleport to Location:</label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const s = controller.getState();
                          s.player.locationId = e.target.value;
                          s.player.travelState = 'resting';
                          controller.publishOptimisticState(s);
                          e.target.value = '';
                        }
                      }}
                      style={{ padding: 4, fontSize: 12, marginTop: 4, width: '100%' }}
                    >
                      <option value="">-- Select Location --</option>
                      {(controller.getState().locations || []).map((loc: any) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {isDevMode && controller && (
                <div style={{ marginTop: 12, borderTop: '1px dashed #444', paddingTop: 8 }}>
                  <h4>Legacy Oracle - Epoch Framework Control</h4>
                  <LegacyOracle state={state} controller={controller} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {state && state.player && state.player.attributePoints > 0 && (
        <LevelUpModal
          state={state}
          isOpen={true}
          onAllocateStat={doAllocateStat}
          onClose={() => setShowLevelUpModal(false)}
        />
      )}

      <CraftingModal
        state={state}
        isOpen={showCraftingModal}
        onCraft={doCraft}
        onClose={() => setShowCraftingModal(false)}
      />

      {/* BETA: Hall of Legends */}
      {showChronicleArchive && state && (
        <ChronicleArchive 
          isOpen={showChronicleArchive}
          onClose={() => setShowChronicleArchive(false)}
          state={state}
        />
      )}

      {/* M29 Task 5: Chronicle Scroll - Deed Timeline Visualization */}
      {state && state.player && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          width: '800px',
          maxHeight: '280px',
          zIndex: 500,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
        }}>
          <ChronicleScroll
            legacyImpacts={state.player.legacyImpacts || []}
            currentCharacterName={state.player.name}
          />
        </div>
      )}

      <ParticleVisualizer state={state} />
      <AudioVisualizer state={state} />
    </div>
  );
}
