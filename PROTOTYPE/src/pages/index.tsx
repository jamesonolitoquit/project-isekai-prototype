import React, { useEffect, useState, useMemo } from "react";
import { createWorldController, createInitialWorld } from "../engine/public";
import SeasonPanel from "../client/components/SeasonPanel";
import WeatherPanel from "../client/components/WeatherPanel";
import QuestPanel from "../client/components/QuestPanel";
import DialogPanel from "../client/components/DialogPanel";
import ParticleVisualizer from "../client/components/ParticleVisualizer";
import AudioVisualizer from "../client/components/AudioVisualizer";
import { getEventsForWorld } from "../engine/public";
import PlayerState from "../client/components/PlayerState";
import TemplatePanel from "../client/dev/TemplatePanel";
import SchemaForm from "../client/dev/SchemaForm";
import * as localBackups from "../client/dev/localBackups";
import sampleTpl from '../data/luxfier-world.json';
import tplSchema from '../data/luxfier-world.schema.json';

export default function HomePage() {
  const [devDockOpen, setDevDockOpen] = useState(true);
  const [controller, setController] = useState<any | null>(null);
  const [state, setState] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');
    const c = createWorldController(undefined, isDev);
    setController(c);
    let unsub: any = null;
    let pollId: any = null;
    if ((c as any).subscribe) {
      unsub = (c as any).subscribe((s: any) => setState(s));
    } else {
      // Poll for state updates when subscribe is not available
      pollId = setInterval(() => {
        try { setState((c as any).getState()); } catch (e) {}
      }, 200);
    }
    if ((c as any).start) (c as any).start();
    setEvents([]);
    return () => {
      try { if (unsub) unsub(); } catch (e) {}
      try { if (pollId) clearInterval(pollId); } catch (e) {}
      try { if ((c as any).stop) (c as any).stop(); } catch (e) {}
    };
  }, []);

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

  const doSave = () => controller?.save();
  const doLoad = () => controller?.load();

  const npcsHere = (state?.npcs || []).filter((n: any) => n.locationId === state?.player?.location);
  const questStatus = state?.player?.quests?.["winter-festival"]?.status || "not_started";

  return (
    <div className="app-root">
      <div className="top-bar">
        <div className="top-left">
          <h1 style={{ margin: 0 }}>Luxfier Prototype</h1>
        </div>
        <div className="top-right">
          <button onClick={() => setDevDockOpen(s => !s)} style={{ marginRight: 8 }}>{devDockOpen ? 'Hide Dev Dock' : 'Show Dev Dock'}</button>
          <button onClick={() => { /* placeholder for other controls */ }}>Enable Audio</button>
        </div>
      </div>

      <div className="main-shell">
        <div className="gameplay-area">
          <div className="gameplay-columns">
            <div className="gameplay-left">
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
                        const title = avail ? `Available ${String(avail.startHour).padStart(2,'0')}:00–${String(avail.endHour).padStart(2,'0')}:00` : undefined;
                        return (
                          <li key={n.id} title={title} style={!isAvailable ? { opacity: 0.4, cursor: 'pointer' } : { cursor: 'pointer' }} onClick={() => {
                            if (!controller) return;
                            if (!isAvailable) {
                              // immediate user feedback while engine also emits NPC_UNAVAILABLE
                              const next = avail?.startHour ?? 0;
                              alert(`The ${n.name} is closed. Returns at ${String(next).padStart(2,'0')}:00.`);
                            }
                            doInteract(n.id);
                          }}>{n.name}{!isAvailable && ' (closed)'}</li>
                        );
                      })}
                    </ul>
                </div>
                <div style={{ marginTop: 8 }} className="controls">
                  <button onClick={() => doMove("town")} disabled={state?.player?.location === "town"}>Move to Town</button>
                  <button onClick={() => doMove("forest")} disabled={state?.player?.location === "forest"}>Move to Forest</button>
                </div>
              </div>
            </div>

            <div className="gameplay-right">
              <div className="dialog-primary">
                <DialogPanel state={state} onChoose={doDialogChoice} />
              </div>
              <div className="context-panels">
                <QuestPanel state={state} />
                <PlayerState state={state} />
              </div>
            </div>
          </div>
        </div>

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
                      {editorBackups.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, borderBottom: '1px solid #eee' }}>
                          <div>
                            <div style={{ fontSize: 12 }}>{b.label}</div>
                            <div style={{ fontSize: 11, color: '#666' }}>{new Date(b.timestamp).toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { const d = localBackups.loadBackup(b.id); if (d) { setEditorWorking(d); setEditorJson(JSON.stringify(d, null,2)); setEditorTab('edit'); } }}>Load</button>
                            <button onClick={() => { localBackups.deleteBackup(b.id); setEditorBackups(localBackups.listBackups()); }}>Delete</button>
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
            </div>
          )}
        </div>
      </div>

      <ParticleVisualizer state={state} />
      <AudioVisualizer state={state} />
    </div>
  );
}
