/**
 * M38 Task 5: Modding Community Hub
 * 
 * Community tab in WorldNexus for one-click mod loading
 * Supports:
 * - GitHub Gist URLs
 * - Direct mod JSON
 * - Mod registry browsing
 * - Active mod management
 */

import React, { useState } from 'react';
import { registerMod, loadModFromJson, injectMultipleMods, getAllMods } from '../../engine/modManager';
import type { Mod } from '../../engine/modManager';
import type { WorldState } from '../../engine/worldEngine';

export interface ModdingCommunityHubProps {
  state: WorldState;
  onModLoaded?: (mod: Mod) => void;
  onModInjected?: (worldState: WorldState) => void;
}

export const ModdingCommunityHub: React.FC<ModdingCommunityHubProps> = ({
  state,
  onModLoaded,
  onModInjected
}) => {
  // =========================================================================
  // STATE
  // =========================================================================

  const [modJsonInput, setModJsonInput] = useState('');
  const [gistUrl, setGistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeMods, setActiveMods] = useState<Mod[]>(getAllMods());
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleLoadModFromJson = async () => {
    if (!modJsonInput.trim()) {
      setError('Please paste mod JSON');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mod = loadModFromJson(modJsonInput);
      registerMod(mod);
      setActiveMods(getAllMods());
      setSuccess(`✅ Mod loaded: ${mod.name}`);
      setModJsonInput('');
      onModLoaded?.(mod);
    } catch (err) {
      setError(`❌ Failed to load mod: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromGist = async () => {
    if (!gistUrl.trim()) {
      setError('Please enter a Gist URL');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Extract Gist ID from URL
      const gistRegex = /gist\.github\.com\/[^/]+\/([a-f0-9]+)/;
      const gistMatch = gistRegex.exec(gistUrl);
      if (!gistMatch) {
        throw new Error('Invalid Gist URL format');
      }

      const rawUrl = `https://gist.githubusercontent.com/${gistUrl.split('/gist.github.com/')[1].replace(/\//g, '/')}/raw`;

      // Fetch Gist content
      const response = await fetch(rawUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Gist: ${response.statusText}`);
      }

      const jsonString = await response.text();
      const mod = loadModFromJson(jsonString);
      registerMod(mod);
      setActiveMods(getAllMods());
      setSuccess(`✅ Remote mod loaded: ${mod.name}`);
      setGistUrl('');
      onModLoaded?.(mod);
    } catch (err) {
      setError(`❌ Failed to load from Gist: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInjectModToWorld = () => {
    try {
      const modIds = activeMods.map(m => m.id);
      const injectedState = injectMultipleMods(state, modIds);
      setSuccess('✅ All active mods injected into world');
      onModInjected?.(injectedState);
    } catch (err) {
      setError(`❌ Failed to inject mods: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div style={{ padding: '16px', color: '#e0e0e0', fontSize: '12px' }}>
      <h2 style={{ color: '#c084fc', marginTop: 0 }}>🎨 Community Modding Hub</h2>

      {/* Error/Success Messages */}
      {error && (
        <div
          style={{
            padding: '8px',
            backgroundColor: 'rgba(220, 38, 38, 0.2)',
            border: '1px solid #dc2626',
            borderRadius: '4px',
            marginBottom: '12px',
            color: '#fca5a5'
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            borderRadius: '4px',
            marginBottom: '12px',
            color: '#6ee7b7'
          }}
        >
          {success}
        </div>
      )}

      {/* TAB 1: Load from Gist */}
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          border: '1px solid #4f2783'
        }}
      >
        <h3 style={{ color: '#a78bfa', margin: '0 0 8px 0' }}>📝 Load from GitHub Gist</h3>
        <input
          type="text"
          placeholder="https://gist.github.com/user/gist-id"
          value={gistUrl}
          onChange={(e) => setGistUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#e0e0e0',
            marginBottom: '8px',
            fontFamily: 'monospace',
            fontSize: '11px'
          }}
        />
        <button
          onClick={handleLoadFromGist}
          disabled={loading}
          style={{
            padding: '6px 12px',
            backgroundColor: '#4f2783',
            border: '1px solid #c084fc',
            color: '#c084fc',
            cursor: loading ? 'not-allowed' : 'pointer',
            borderRadius: '3px',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? '⏳ Loading...' : '📥 Load Mod'}
        </button>
      </div>

      {/* TAB 2: Paste JSON */}
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          border: '1px solid #4f2783'
        }}
      >
        <h3 style={{ color: '#a78bfa', margin: '0 0 8px 0' }}>📋 Paste Mod JSON</h3>
        <textarea
          placeholder='{"id":"my-mod","name":"My Mod","version":"1.0.0","content":{}}'
          value={modJsonInput}
          onChange={(e) => setModJsonInput(e.target.value)}
          style={{
            width: '100%',
            height: '120px',
            padding: '8px',
            backgroundColor: '#1a1a2e',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#e0e0e0',
            marginBottom: '8px',
            fontFamily: 'monospace',
            fontSize: '10px',
            resize: 'vertical'
          }}
        />
        <button
          onClick={handleLoadModFromJson}
          disabled={loading}
          style={{
            padding: '6px 12px',
            backgroundColor: '#4f2783',
            border: '1px solid #c084fc',
            color: '#c084fc',
            cursor: loading ? 'not-allowed' : 'pointer',
            borderRadius: '3px',
            opacity: loading ? 0.5 : 1
          }}
        >
          {loading ? '⏳ Loading...' : '📥 Load Mod'}
        </button>
      </div>

      {/* Active Mods List */}
      <div
        style={{
          backgroundColor: 'rgba(79, 39, 131, 0.1)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          border: '1px solid #4f2783'
        }}
      >
        <h3 style={{ color: '#a78bfa', margin: '0 0 8px 0' }}>
          ⚙️ Active Mods ({activeMods.length})
        </h3>

        {activeMods.length === 0 ? (
          <p style={{ color: '#666', margin: 0 }}>No mods loaded yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeMods.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setSelectedMod(selectedMod?.id === mod.id ? null : mod)}
                style={{
                  padding: '8px',
                  backgroundColor: selectedMod?.id === mod.id ? 'rgba(160, 144, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  border: `1px solid ${selectedMod?.id === mod.id ? '#a090ff' : '#333'}`,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  color: 'inherit',
                  font: 'inherit'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#c084fc' }}>
                  {mod.name} v{mod.version}
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>{mod.description || 'No description'}</div>
                {selectedMod?.id === mod.id && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa' }}>
                    <div>📝 ID: {mod.id}</div>
                    <div>👤 Author: {mod.author || 'Unknown'}</div>
                    {mod.content.items && (
                      <div>🎁 Items: {mod.content.items.length}</div>
                    )}
                    {mod.content.npcs && (
                      <div>👥 NPCs: {mod.content.npcs.length}</div>
                    )}
                    {mod.content.quests && (
                      <div>⚔️ Quests: {mod.content.quests.length}</div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inject Mods Button */}
      <button
        onClick={handleInjectModToWorld}
        disabled={activeMods.length === 0}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: activeMods.length === 0 ? '#333' : '#10b981',
          border: activeMods.length === 0 ? '1px solid #555' : '1px solid #6ee7b7',
          color: activeMods.length === 0 ? '#666' : '#fff',
          cursor: activeMods.length === 0 ? 'not-allowed' : 'pointer',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '12px'
        }}
      >
        ✨ Inject All Mods Into World
      </button>

      {/* Help Text */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid #3b82f6',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#93c5fd'
        }}
      >
        <strong>💡 Mod Format Guide</strong>
        <div style={{ marginTop: '4px' }}>
          Mods must include: id, name, version, content (items/npcs/quests/locations). Optional: author,
          description, compatibility, metadata.
        </div>
      </div>
    </div>
  );
};

export default ModdingCommunityHub;
