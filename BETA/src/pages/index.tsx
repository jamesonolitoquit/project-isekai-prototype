import React from 'react';

export default function HomePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>BETA Website Test</h1>
      <p>If you can see this, the basic Next.js setup is working!</p>
    </div>
  );
}

/**
 * Phase 7: WorldController Interface - Formal type contract
 * Eliminates unsafe property access on controller object
 */
interface WorldController {
  getState(): WorldState;
  subscribe(callback: (state: WorldState) => void): () => void;
  performAction(action: {
    worldId: string;
    playerId: string;
    type: string;
    payload?: Record<string, any>;
  }): void;
  start(): void;
  stop(): void;
}

export default function HomePage() {
  const [devDockOpen, setDevDockOpen] = useState(false);
  const [controller, setController] = useState<WorldController | null>(null); // Phase 7: Hardened type
  const [state, setState] = useState<WorldState | null>(null); // Phase 7: Hardened type
  const [events, setEvents] = useState<any[]>([]);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isDirector, setIsDirector] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showLevelUPModal, setShowLevelUpModal] = useState(false);
  const [showCraftingModal, setShowCraftingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'world' | 'combat' | 'politics' | 'arcane' | 'codex'>('world');

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
      try { controller.stop(); } catch (e) {} // Phase 7: Direct method call, no cast needed
    }
    // create initial state from template and instantiate a controller with it
    const initial = createInitialWorld(`world-${Date.now()}`, tpl);
    const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');
    const c = createWorldController(initial, isDev) as WorldController; // Phase 7: Safe cast from createWorldController return
    setController(c);
    if (c.subscribe) {
      const unsub = c.subscribe((s: WorldState) => setState(s)); // Phase 7: Hardened callback type
    } else {
      // start a poll for state updates
      const id = setInterval(() => { try { setState(c.getState()); } catch (e) {} }, 200); // Phase 7: Direct method call
      // clear when switching templates
      setTimeout(() => clearInterval(id), 0);
    }
    c.start(); // Phase 7: Direct method call
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

  // Keyboard navigation (Shift+D for Director Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return; // Don't interfere with system shortcuts

      // Director Mode toggle: Shift+D
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDirector(prev => !prev);
        return;
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Export full debug state (telemetry)
  const exportFullDebugState = useCallback(() => {
    if (!state) return;
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
  }, [state]);

  const npcsHere = (state?.npcs || []).filter((n: any) => n.locationId === state?.player?.location);
  const questStatus = state?.player?.quests?.["winter-festival"]?.status || "not_started";

  // Action wrapper to update tab and perform action
  const performActionWithFeedback = (actionRequest: any) => {
    if (actionRequest.type === 'ATTACK' || actionRequest.type === 'DEFEND' || actionRequest.type === 'PARRY') {
      setActiveTab('combat');
    }
    controller?.performAction(actionRequest);
  };

  // M15 Step 4: Global visual impulses (screen shake, glitch, chromatic aberration)
  const visuals = useGlobalVisuals(events, state, { debug: false });

  // Build dynamic classes for app-root based on visual state
  const appRootClasses = [
    'app-root',
    'omni-hud',
    visuals.shakeActive && 'vibrate',
    visuals.chromaActive && 'reality-thinning',
    visuals.glitchIntensity > 0.5 && 'paradox-glitch-severe',
    visuals.glitchIntensity > 0.3 && visuals.glitchIntensity <= 0.5 && 'paradox-glitch'
  ]
    .filter(Boolean)
    .join(' ');

  // Calculate paradox intensity for CSS variables (0-1 range)
  const chaosScore = state?.paradoxLevel ?? 0; // Phase 7: Updated property name
  const normalizedChaos = Math.min(1.0, chaosScore / 100);

  // Phase 7: Properly typed CSS variable object using CSSProperties
  const appRootStyle: CSSProperties & Record<string, any> = {
    '--paradox-intensity': normalizedChaos,
    '--glitch-intensity': visuals.glitchIntensity,
    '--shake-intensity': visuals.shakeIntensity,
    '--flash-intensity': visuals.flashIntensity
  };

  return (
    <ClientOnly>
      <div className={appRootClasses} style={appRootStyle}> {/* Phase 7: No cast needed with proper type */}
      {/* M15 Step 4: Global flash overlay for spell casting */}
      {visuals.flashActive && (
        <div
          id="global-flash-overlay"
          style={{
            backgroundColor: visuals.flashColor,
            opacity: visuals.flashIntensity,
            animation: 'flash-overlay 0.3s ease-out forwards'
          }}
        />
      )}

      {/* M15 Step 4: Chromatic aberration overlay */}
      {visuals.chromaActive && <div id="chromatic-overlay" style={{ opacity: visuals.glitchIntensity }} />}

      {/* M47-B1: Perception Glitch Overlay - Reality distortion effects based on chaos score */}
      {state && <PerceptionGlitchOverlay appState={state} />}

      {/* Global Paradox Indicator Overlay */}
      {state && <ParadoxIndicator state={state} />}

      {/* Global Travel Progress Overlay */}
      {state && <TravelProgress state={state} />}

      {/* ALPHA_M2: Narrative Stimulus Toast Display */}
      {state && <NarrativeStimulus events={events} audioState={state.audio} />}

      {/* M15 Step 5: Faction Territory Visual Overlay */}
      {state && <FactionVisualOverlay state={state} enabled={true} />}

      {/* Global Persistent HUD Header */}
      {state && !state.needsCharacterCreation && (
        <GlobalHeader
          state={state}
          isDirector={isDirector}
          onToggleDirector={() => setIsDirector(prev => !prev)}
          onExportDebug={exportFullDebugState}
        />
      )}

      <div className="main-shell">
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
                      {/* M47-D1: Chronicle Map - World Fragment Visualization */}
                      <ChronicleMap 
                        worldState={state} 
                        onLocationSelect={(locId) => doMove(locId)}
                        showLegend={true}
                        useAbsolutePositioning={true}
                      />
                      {/* M47-E1: Enhanced Dialog Panel - Sensory Cues */}
                      <EnhancedDialogPanel
                        dialogue={state?.dialogueHistory || []}
                        playerPerceptionLevel={state?.player?.perception || 50}
                        enableGoalVisibility={true}
                        showOracleView={false}
                      />
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '100%' }}>
                    <div style={{ borderRight: '1px solid #444', paddingRight: '12px', overflowY: 'auto' }}>
                      <FactionPanel state={state} />
                    </div>
                    <div style={{ paddingLeft: '12px', overflowY: 'auto' }}>
                      <h3>Rumor Mill - Intelligence Layer</h3>
                      <RumorMillUI 
                        state={state}
                        playerPerceptionLevel={state?.player?.perception || 50}
                      />
                    </div>
                  </div>
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
                      <MorphingStation state={state} onInitiateRitual={(targetRace) => state?.player?.id && performActionWithFeedback({ worldId: state.id, playerId: state.player.id, type: 'INITIATE_MORPH', payload: { targetRace } })} />
                    </div>
                  </div>
                </div>
              )}

              {/* CODEX TAB */}
              {activeTab === 'codex' && (
                <div className="tab-content codex-tab">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '100%' }}>
                    <div style={{ borderRight: '1px solid #444', paddingRight: '12px', overflowY: 'auto' }}>
                      <Codex state={state} />
                    </div>
                    <div style={{ paddingLeft: '12px', overflowY: 'auto' }}>
                      <h3>Soul Mirror - Legacy Archives</h3>
                      <SoulMirrorOverlay 
                        character={state?.player}
                        unlockedSoulEchoes={state?.unlockedSoulEchoes || []}
                        activeResonanceEchoId={state?.player?.activeResonanceEchoId}
                        resonanceAdvice={state?.player?.activeResonanceAdvice}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ALPHA_M14: The Dice Altar - Central Systemic Anchor */}
        {state && !state.needsCharacterCreation && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 90
          }}>
            <DiceAltar state={{ ...state, events }} />
          </div>
        )}

        <div className={`dev-dock ${devDockOpen ? 'open' : 'collapsed'}`}>
          {isDevMode && (
            <div className="dev-dock-inner">
              <div style={{ padding: '8px 12px', background: '#3b82f6', color: '#fff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>THE ARCHITECT'S FORGE</span>
                <button 
                  onClick={() => setDevDockOpen(!devDockOpen)}
                  style={{ background: 'none', border: '1px solid #fff', color: '#fff', cursor: 'pointer', padding: '0 4px' }}
                >
                  {devDockOpen ? '▼' : '▲'}
                </button>
              </div>
              <TemplatePanel onLoad={loadTemplateIntoController} />
              <div style={{ border: '1px solid #666', padding: 10, marginTop: 8 }}>
                <h4>Forge: Advanced Template Editor</h4>
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
                      {(controller?.getState?.()?.locations || []).map((loc: any) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
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

      <ParticleVisualizer state={state} />
      <AudioVisualizer state={state} />

      {/* Director Mode Overlay */}
      {isDirector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #c084fc',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '600px',
            width: '90%',
            color: '#fff'
          }}>
            <h2 style={{ color: '#c084fc', marginTop: 0 }}>Director Mode</h2>
            <p>Director dashboard functionality will be implemented here.</p>
            <p>Current features:</p>
            <ul>
              <li>Narrative control tools</li>
              <li>Debug telemetry export</li>
              <li>World state monitoring</li>
            </ul>
            <button
              onClick={() => setIsDirector(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b21a8',
                border: '2px solid #c084fc',
                color: '#e9d5ff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '4px',
                marginTop: '20px'
              }}
            >
              Exit Director Mode
            </button>
          </div>
        </div>
      )}
    </div>
    </ClientOnly>
  );
}

export const dynamic = 'force-dynamic'; // [M48-A4: Disable static generation for interactive page]
