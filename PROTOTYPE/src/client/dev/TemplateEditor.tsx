import React, { useEffect, useState } from 'react';
import SchemaForm from './SchemaForm';
import { listBackups, saveBackup as saveBackupLS, deleteBackup as deleteBackupLS, loadBackup as loadBackupLS } from './localBackups';
import schema from '../../data/luxfier-world.schema.json';
import sampleTpl from '../../data/luxfier-world.json';

const DRAFT_KEY = 'luxfier_template_draft';

type Props = { onLoad: (tpl: any) => void };

type SaveStatus = { status: 'idle' | 'saving' | 'ok' | 'error'; message?: string; details?: any } | null;

export default function TemplateEditor({ onLoad }: Props) {
  const sample = sampleTpl || { locations: [], npcs: [], quests: [], metadata: {} };
  const initialDraft = (() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : sample;
    } catch (e) {
      return sample;
    }
  })();

  const [draft, setDraftState] = useState<any>(initialDraft);
  const [history, setHistory] = useState<any[]>(() => [structuredCloneSafe(initialDraft)]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  // keyboard shortcuts for undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'y') || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyIndex, history]);
  const [valid, setValid] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<any[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [backups, setBackups] = useState<any[]>(() => listBackups());
  const [validationPaths, setValidationPaths] = useState<string[]>([]);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState<'content'|'json'|'backups'>('content');

  useEffect(() => {
    // validate using Ajv if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Ajv = require('ajv');
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(schema);
      const ok = validate(draft);
      setValid(Boolean(ok));
      setErrors(ok ? null : (validate.errors || null));
      // build validation path map (dot-notation) for SchemaForm highlighting
      if (validate.errors && validate.errors.length) {
        const paths: string[] = [];
        for (const err of validate.errors) {
          return (
            <div style={{ border: '1px solid #666', padding: 10, marginBottom: 12 }}>
              <h4>Dev: Template Editor</h4>

              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setTab('content')} style={{ fontWeight: tab === 'content' ? '700' : '400' }}>Content</button>
                  <button onClick={() => setTab('json')} style={{ fontWeight: tab === 'json' ? '700' : '400' }}>JSON</button>
                  <button onClick={() => setTab('backups')} style={{ fontWeight: tab === 'backups' ? '700' : '400' }}>Backups</button>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={() => { const el = document.getElementById('template-editor-help'); if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; } }}>Help</button>
                </div>
              </div>

              <div id="template-editor-help" style={{ display: 'none', marginBottom: 10, background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>Quick tips:</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  <li>Use <strong>Undo</strong>/<strong>Redo</strong> or Ctrl+Z / Ctrl+Y to revert edits.</li>
                  <li><strong>Import</strong> accepts a JSON template; <strong>Export</strong> downloads your draft.</li>
                  <li>Click <strong>Show JSON</strong> to inspect the full template before loading.</li>
                  <li>Fields support inline validation; fix errors shown in the validation area.</li>
                </ul>
              </div>

              {/* Tab: Content */}
              {tab === 'content' && (
                <div>
                  {/* inline status banner */}
                  <div style={{ marginBottom: 8 }}>
                    {saveStatus?.status === 'ok' && (
                      <div style={{ background: '#e6ffed', color: '#083', padding: '6px 8px', borderRadius: 4 }}>{saveStatus.message}</div>
                    )}
                    {saveStatus?.status === 'error' && (
                      <div style={{ background: '#ffecec', color: '#a00', padding: '6px 8px', borderRadius: 4 }}>
                        <div>{saveStatus.message}</div>
                        {saveStatus.details && <div style={{ fontSize: 12, marginTop: 6 }}><button onClick={() => setShowValidationDetails(s => !s)}>{showValidationDetails ? 'Hide details' : 'Show details'}</button></div>}
                      </div>
                    )}
                    {valid === false && !saveStatus?.status && (
                      <div style={{ background: '#fff7e6', color: '#a60', padding: '6px 8px', borderRadius: 4 }}>
                        Schema validation: issues detected. <button onClick={() => setShowValidationDetails(s => !s)} style={{ marginLeft: 8 }}>{showValidationDetails ? 'Hide' : 'Show'}</button>
                      </div>
                    )}
                    {showValidationDetails && errors && (
                      <pre style={{ maxHeight: 200, overflow: 'auto', background: '#f8f8f8', padding: 8, marginTop: 6 }}>{JSON.stringify(errors, null, 2)}</pre>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Validation:</strong>{' '}
                        {valid === true && <span style={{ color: 'green' }}>OK</span>}
                        {valid === false && <span style={{ color: 'crimson' }}>Invalid</span>}
                        {valid === null && <span style={{ color: 'gray' }}>Unknown</span>}
                      </div>
                      {errors && <pre style={{ maxHeight: 120, overflow: 'auto' }}>{JSON.stringify(errors, null, 2)}</pre>}

                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <button onClick={undo} disabled={historyIndex <= 0}>Undo</button>
                          <button onClick={redo} disabled={historyIndex >= history.length - 1} style={{ marginLeft: 8 }}>Redo</button>
                        </div>
                        <div>
                          <button onClick={saveDraft}>Save Draft</button>
                          <button style={{ marginLeft: 8 }} onClick={() => { applyDraft(draft, true); onLoad(draft); }}>Load into world</button>
                          <button style={{ marginLeft: 8 }} onClick={resetToSample}>Reset</button>
                          <button style={{ marginLeft: 8 }} onClick={() => exportDraft()}>Export</button>
                          <label style={{ marginLeft: 8 }} title="Import template JSON"><input type="file" accept="application/json" style={{ display: 'none' }} id="tplImport" onChange={(e) => importDraft(e)} /> <button onClick={() => document.getElementById('tplImport')?.click()}>Import</button></label>
                        </div>
                        <div style={{ marginLeft: 12 }}>
                          {saveStatus?.status === 'saving' && <em>{saveStatus.message}</em>}
                          {saveStatus?.status === 'ok' && <span style={{ color: 'green' }}>{saveStatus.message}</span>}
                          {saveStatus?.status === 'error' && <span style={{ color: 'crimson' }}>{saveStatus.message}</span>}
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Template JSON Preview</strong>
                          <div>
                            <button onClick={() => setShowPreview(s => !s)} style={{ marginRight: 8 }}>{showPreview ? 'Hide JSON' : 'Show JSON'}</button>
                          </div>
                        </div>
                        <pre style={{ maxHeight: showPreview ? 320 : 72, overflow: 'auto', whiteSpace: 'pre-wrap', transition: 'max-height 200ms ease' }}>{JSON.stringify(draft, null, 2)}</pre>
                        {saveStatus?.details && <pre style={{ color: '#800' }}>{JSON.stringify(saveStatus.details, null, 2)}</pre>}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <strong>Backups</strong>
                        <div style={{ maxHeight: 140, overflow: 'auto', background: '#fafafa', padding: 8, marginTop: 6 }}>
                          {backups.length === 0 && <div style={{ color: '#666' }}>No backups yet</div>}
                          {backups.map((b: any) => (
                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 6, borderBottom: '1px solid #eee' }}>
                              <div style={{ fontSize: 12 }}>
                                <div><strong>{b.label || new Date(b.timestamp).toLocaleString()}</strong></div>
                                <div style={{ fontSize: 11, color: '#666' }}>{new Date(b.timestamp).toISOString()}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => restoreBackup(b.id)}>Restore</button>
                                <button onClick={() => removeBackup(b.id)}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ width: '100%', minWidth: 320 }}>
                      <section style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Locations</strong>
                          <button onClick={() => { const id = `loc-${Date.now()}`; addListItem('locations', { id, name: id }); }}>Add</button>
                        </div>
                        <div>
                          {(draft.locations || []).map((l: any, i: number) => (
                            <div key={l.id || i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                              <SchemaForm schema={schema.properties.locations.items} value={l} onChange={(v) => setListItem('locations', i, v)} extraContext={{ validationPaths, basePath: `locations.${i}`, errors }} />
                              <button onClick={() => removeListItem('locations', i)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>NPCs</strong>
                          <button onClick={() => { const id = `npc-${Date.now()}`; addListItem('npcs', { id, name: id, locationId: (draft.locations && draft.locations[0] && draft.locations[0].id) || 'town', dialogue: [] }); }}>Add NPC</button>
                        </div>
                        <div>
                          {(draft.npcs || []).map((n: any, i: number) => (
                            <div key={n.id || i} style={{ borderTop: '1px solid #ddd', paddingTop: 6, marginTop: 6 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <SchemaForm schema={schema.properties.npcs.items} value={n} onChange={(v) => setListItem('npcs', i, v)} extraContext={{ locations: draft.locations || [], quests: draft.quests || [], validationPaths, basePath: `npcs.${i}`, errors }} />
                                <button onClick={() => removeListItem('npcs', i)}>Remove</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>Quests</strong>
                          <button onClick={() => { const id = `quest-${Date.now()}`; addListItem('quests', { id, title: id, objective: { type: 'visit', location: (draft.locations && draft.locations[0] && draft.locations[0].id) || 'town' } }); }}>Add Quest</button>
                        </div>
                        <div>
                          {(draft.quests || []).map((q: any, i: number) => (
                            <div key={q.id || i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                              <SchemaForm schema={schema.properties.quests.items} value={q} onChange={(v) => setListItem('quests', i, v)} extraContext={{ locations: draft.locations || [], validationPaths, basePath: `quests.${i}`, errors }} />
                              <button onClick={() => removeListItem('quests', i)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: JSON */}
              {tab === 'json' && (
                <div>
                  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={saveDraft}>Save Draft</button>
                    <button onClick={() => { applyDraft(draft, true); onLoad(draft); }} style={{ marginLeft: 8 }}>Load into world</button>
                    <button onClick={resetToSample} style={{ marginLeft: 8 }}>Reset</button>
                    <button onClick={() => exportDraft()} style={{ marginLeft: 8 }}>Export</button>
                    <label style={{ marginLeft: 8 }} title="Import template JSON"><input type="file" accept="application/json" style={{ display: 'none' }} id="tplImportJson" onChange={(e) => importDraft(e)} /> <button onClick={() => document.getElementById('tplImportJson')?.click()}>Import</button></label>
                    <div style={{ marginLeft: 'auto' }}>{saveStatus?.status === 'saving' && <em>{saveStatus.message}</em>}</div>
                  </div>
                  <div>
                    <strong>Full Template JSON</strong>
                    <pre style={{ maxHeight: 560, overflow: 'auto', whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(draft, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Tab: Backups */}
              {tab === 'backups' && (
                <div>
                  <div>
                    <strong>Backups</strong>
                    <div style={{ maxHeight: 420, overflow: 'auto', background: '#fafafa', padding: 8, marginTop: 6 }}>
                      {backups.length === 0 && <div style={{ color: '#666' }}>No backups yet</div>}
                      {backups.map((b: any) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 6, borderBottom: '1px solid #eee' }}>
                          <div style={{ fontSize: 12 }}>
                            <div><strong>{b.label || new Date(b.timestamp).toLocaleString()}</strong></div>
                            <div style={{ fontSize: 11, color: '#666' }}>{new Date(b.timestamp).toISOString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => restoreBackup(b.id)}>Restore</button>
                            <button onClick={() => removeBackup(b.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }
      setSaveStatus({ status: 'error', message: 'Backup not found' });
    }
  }

  function removeBackup(id: string) {
    deleteBackupLS(id);
    refreshBackups();
  }

  function undo() {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const snap = history[newIndex];
    setHistoryIndex(newIndex);
    setDraftState(structuredCloneSafe(snap));
    setSaveStatus({ status: 'idle', message: 'Undone' });
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const snap = history[newIndex];
    setHistoryIndex(newIndex);
    setDraftState(structuredCloneSafe(snap));
    setSaveStatus({ status: 'idle', message: 'Redone' });
  }

  function structuredCloneSafe(obj: any) {
    try {
      // @ts-ignore
      return structuredClone(obj);
    } catch (e) {
      return JSON.parse(JSON.stringify(obj));
    }
  }

  const [tab, setTab] = useState<'content'|'json'|'backups'>('content');

  return (
    <div style={{ border: '1px solid #666', padding: 10, marginBottom: 12 }}>
      <h4>Dev: Template Editor</h4>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('content')} style={{ fontWeight: tab === 'content' ? '700' : '400' }}>Content</button>
          <button onClick={() => setTab('json')} style={{ fontWeight: tab === 'json' ? '700' : '400' }}>JSON</button>
          <button onClick={() => setTab('backups')} style={{ fontWeight: tab === 'backups' ? '700' : '400' }}>Backups</button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => { const el = document.getElementById('template-editor-help'); if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; } }}>Help</button>
        </div>
      </div>
      <div id="template-editor-help" style={{ display: 'none', marginBottom: 10, background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 6 }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Quick tips:</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
          <li>Use <strong>Undo</strong>/<strong>Redo</strong> or Ctrl+Z / Ctrl+Y to revert edits.</li>
          <li><strong>Import</strong> accepts a JSON template; <strong>Export</strong> downloads your draft.</li>
