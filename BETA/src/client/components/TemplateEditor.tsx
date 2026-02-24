/**
 * TemplateEditor.tsx - ALPHA_M14: The Architect's Forge
 * 
 * UI component for world template customization and hot-swapping
 * Allows players to forge world blueprints and customize:
 * - Biomes (terrain, features)
 * - Starting NPCs
 * - Faction relations
 * - Initial state
 * 
 * Features:
 * - Dev-tool component (initially)
 * - Validates templates via constraintValidator
 * - Persists to templateStorage
 * - Hot-swap support for live template switching
 */

import React, { useState, useEffect } from 'react';
import { WorldState } from '../../engine/worldEngine';

interface TemplateEditorProps {
  state: WorldState;
  onSaveTemplate: (templateName: string, templateData: any) => void;
  onLoadTemplate: (templateName: string) => void;
  onValidateTemplate: (templateData: any) => { valid: boolean; errors: string[] };
  isDeveloperMode?: boolean;
}

interface BiomeConfig {
  id: string;
  name: string;
  terrain: 'forest' | 'cave' | 'village' | 'corrupted' | 'desert' | 'maritime' | 'shrine';
  features: string[];
  ambiance: string;
}

interface NPCConfig {
  id: string;
  name: string;
  role: string;
  startingLocation: string;
  disposition: number; // -100 to +100
}

interface TemplateState {
  templates: Map<string, any>;
  currentTemplate: string | null;
  editing: boolean;
  validationErrors: string[];
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ 
  state, 
  onSaveTemplate, 
  onLoadTemplate,
  onValidateTemplate,
  isDeveloperMode = true 
}) => {
  const [templateState, setTemplateState] = useState<TemplateState>({
    templates: new Map(),
    currentTemplate: null,
    editing: false,
    validationErrors: []
  });

  const [biomes, setBiomes] = useState<BiomeConfig[]>([]);
  const [npcs, setNpcs] = useState<NPCConfig[]>([]);
  const [factionRelations, setFactionRelations] = useState<Record<string, Record<string, number>>>({});
  const [templateName, setTemplateName] = useState('');
  const [activeTab, setActiveTab] = useState<'biomes' | 'npcs' | 'factions' | 'library'>('biomes');

  // Guard against null state
  if (!state || !isDeveloperMode) {
    return (
      <div className="template-editor-panel">
        <p>Template Editor (Dev Mode Only)</p>
      </div>
    );
  }

  const handleAddBiome = () => {
    const newBiome: BiomeConfig = {
      id: `biome-${Date.now()}`,
      name: 'New Biome',
      terrain: 'forest',
      features: [],
      ambiance: ''
    };
    setBiomes([...biomes, newBiome]);
  };

  const handleUpdateBiome = (id: string, updates: Partial<BiomeConfig>) => {
    setBiomes(biomes.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleRemoveBiome = (id: string) => {
    setBiomes(biomes.filter(b => b.id !== id));
  };

  const handleAddNpc = () => {
    const newNpc: NPCConfig = {
      id: `npc-${Date.now()}`,
      name: 'New NPC',
      role: 'merchant',
      startingLocation: state.locations?.[0]?.id || 'village-center',
      disposition: 0
    };
    setNpcs([...npcs, newNpc]);
  };

  const handleUpdateNpc = (id: string, updates: Partial<NPCConfig>) => {
    setNpcs(npcs.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleRemoveNpc = (id: string) => {
    setNpcs(npcs.filter(n => n.id !== id));
  };

  const handleSetFactionRelation = (faction1: string, faction2: string, value: number) => {
    const key1 = `${faction1}:${faction2}`;
    const key2 = `${faction2}:${faction1}`;
    
    const newRelations = { ...factionRelations };
    if (!newRelations[faction1]) newRelations[faction1] = {};
    if (!newRelations[faction2]) newRelations[faction2] = {};
    
    newRelations[faction1][faction2] = value;
    newRelations[faction2][faction1] = value;
    
    setFactionRelations(newRelations);
  };

  const handleValidateTemplate = () => {
    const templateData = {
      biomes,
      npcs,
      factionRelations,
      timestamp: Date.now()
    };

    const result = onValidateTemplate(templateData);
    setTemplateState(prev => ({
      ...prev,
      validationErrors: result.errors
    }));

    return result.valid;
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (!handleValidateTemplate()) {
      alert('Template has validation errors. See details below.');
      return;
    }

    const templateData = {
      name: templateName,
      biomes,
      npcs,
      factionRelations,
      timestamp: Date.now()
    };

    onSaveTemplate(templateName, templateData);
    setTemplateName('');
    setTemplateState(prev => ({
      ...prev,
      templates: prev.templates.set(templateName, templateData),
      validationErrors: []
    }));
  };

  const handleLoadTemplate = (name: string) => {
    onLoadTemplate(name);
    setTemplateState(prev => ({
      ...prev,
      currentTemplate: name
    }));
  };

  const handleHotSwap = (templateName: string) => {
    if (window.confirm(`Hot-swap to template "${templateName}"? Current world state will be replaced.`)) {
      handleLoadTemplate(templateName);
    }
  };

  return (
    <div className="template-editor-panel" style={styles.container}>
      <h2>The Architect's Forge</h2>
      <p style={styles.subtitle}>Customize and forge world templates</p>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        <button 
          onClick={() => setActiveTab('biomes')}
          style={{...styles.tab, ...(activeTab === 'biomes' ? styles.tabActive : {})}}
        >
          Biomes
        </button>
        <button 
          onClick={() => setActiveTab('npcs')}
          style={{...styles.tab, ...(activeTab === 'npcs' ? styles.tabActive : {})}}
        >
          NPCs
        </button>
        <button 
          onClick={() => setActiveTab('factions')}
          style={{...styles.tab, ...(activeTab === 'factions' ? styles.tabActive : {})}}
        >
          Factions
        </button>
        <button 
          onClick={() => setActiveTab('library')}
          style={{...styles.tab, ...(activeTab === 'library' ? styles.tabActive : {})}}
        >
          Library
        </button>
      </div>

      {/* Biomes Tab */}
      {activeTab === 'biomes' && (
        <div style={styles.tabContent}>
          <h3>World Biomes</h3>
          <button onClick={handleAddBiome} style={styles.addButton}>+ Add Biome</button>
          
          {biomes.map(biome => (
            <div key={biome.id} style={styles.configItem}>
              <input
                type="text"
                value={biome.name}
                onChange={(e) => handleUpdateBiome(biome.id, { name: e.target.value })}
                placeholder="Biome name"
                style={styles.input}
              />
              <select
                value={biome.terrain}
                onChange={(e) => handleUpdateBiome(biome.id, { terrain: e.target.value as any })}
                style={styles.input}
              >
                <option value="forest">Forest</option>
                <option value="cave">Cave</option>
                <option value="village">Village</option>
                <option value="corrupted">Corrupted</option>
                <option value="desert">Desert</option>
                <option value="maritime">Maritime</option>
                <option value="shrine">Shrine</option>
              </select>
              <input
                type="text"
                value={biome.ambiance}
                onChange={(e) => handleUpdateBiome(biome.id, { ambiance: e.target.value })}
                placeholder="Ambiance description"
                style={styles.input}
              />
              <button onClick={() => handleRemoveBiome(biome.id)} style={styles.removeButton}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* NPCs Tab */}
      {activeTab === 'npcs' && (
        <div style={styles.tabContent}>
          <h3>Starting NPCs</h3>
          <button onClick={handleAddNpc} style={styles.addButton}>+ Add NPC</button>
          
          {npcs.map(npc => (
            <div key={npc.id} style={styles.configItem}>
              <input
                type="text"
                value={npc.name}
                onChange={(e) => handleUpdateNpc(npc.id, { name: e.target.value })}
                placeholder="NPC name"
                style={styles.input}
              />
              <input
                type="text"
                value={npc.role}
                onChange={(e) => handleUpdateNpc(npc.id, { role: e.target.value })}
                placeholder="Role"
                style={styles.input}
              />
              <select
                value={npc.startingLocation}
                onChange={(e) => handleUpdateNpc(npc.id, { startingLocation: e.target.value })}
                style={styles.input}
              >
                {state.locations?.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <div style={styles.dispositionControl}>
                <label>Disposition: {npc.disposition}</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={npc.disposition}
                  onChange={(e) => handleUpdateNpc(npc.id, { disposition: parseInt(e.target.value) })}
                  style={styles.range}
                />
              </div>
              <button onClick={() => handleRemoveNpc(npc.id)} style={styles.removeButton}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Factions Tab */}
      {activeTab === 'factions' && (
        <div style={styles.tabContent}>
          <h3>Faction Relations</h3>
          <p style={styles.hint}>Set tensions between factions (-100 = enemies, 0 = neutral, +100 = allies)</p>
          
          {state.factions && state.factions.map((f1, index) => {
            // ... render faction relation interface
            return null;
          })}
          <p style={styles.hint}>(Faction relation UI - configure tensions between allied factions)</p>
        </div>
      )}

      {/* Library Tab - Load Saved Templates */}
      {activeTab === 'library' && (
        <div style={styles.tabContent}>
          <h3>Template Library</h3>
          <div style={styles.libraryList}>
            <p>Saved templates (simulated):</p>
            {Array.from(templateState.templates.entries()).map(([name, _]) => (
              <div key={name} style={styles.libraryItem}>
                <span>{name}</span>
                <button onClick={() => handleHotSwap(name)} style={styles.loadButton}>
                  Hot-Swap
                </button>
              </div>
            ))}
            {templateState.templates.size === 0 && <p>No saved templates yet</p>}
          </div>
        </div>
      )}

      {/* Save Section */}
      <div style={styles.saveSection}>
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Enter template name"
          style={styles.input}
        />
        <button onClick={handleValidateTemplate} style={styles.validateButton}>
          Validate
        </button>
        <button onClick={handleSaveTemplate} style={styles.saveButton}>
          Save Template
        </button>
      </div>

      {/* Validation Errors */}
      {templateState.validationErrors.length > 0 && (
        <div style={styles.errorBox}>
          <h4>Validation Errors:</h4>
          <ul>
            {templateState.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Current Template Info */}
      {templateState.currentTemplate && (
        <div style={styles.infoBox}>
          <p>Currently loaded: <strong>{templateState.currentTemplate}</strong></p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    borderRadius: '8px',
    maxWidth: '800px'
  },
  subtitle: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '20px'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '1px solid #333'
  },
  tab: {
    padding: '10px 15px',
    backgroundColor: '#2d2d44',
    color: '#999',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },
  tabActive: {
    backgroundColor: '#444',
    color: '#fff',
    borderBottom: '2px solid #0f3',
  },
  tabContent: {
    marginBottom: '20px'
  },
  configItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '12px',
    backgroundColor: '#252538',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid #333'
  },
  input: {
    padding: '8px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '12px'
  },
  range: {
    width: '100%',
    marginTop: '5px'
  },
  dispositionControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  addButton: {
    padding: '8px 12px',
    backgroundColor: '#0f3',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '10px',
    fontWeight: 'bold'
  },
  removeButton: {
    padding: '6px 10px',
    backgroundColor: '#f33',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  loadButton: {
    padding: '6px 10px',
    backgroundColor: '#33f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  saveButton: {
    padding: '8px 12px',
    backgroundColor: '#0f3',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  validateButton: {
    padding: '8px 12px',
    backgroundColor: '#f90',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  saveSection: {
    display: 'flex',
    gap: '10px',
    padding: '15px',
    backgroundColor: '#252538',
    borderRadius: '4px',
    marginTop: '20px'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#3d1a1a',
    color: '#ff6666',
    borderRadius: '4px',
    marginTop: '15px',
    border: '1px solid #663333'
  },
  infoBox: {
    padding: '12px',
    backgroundColor: '#1a3d1a',
    color: '#66ff66',
    borderRadius: '4px',
    marginTop: '15px',
    border: '1px solid #336633'
  },
  libraryList: {
    backgroundColor: '#252538',
    padding: '12px',
    borderRadius: '4px'
  },
  libraryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    borderBottom: '1px solid #333',
    marginBottom: '8px'
  },
  hint: {
    fontSize: '11px',
    color: '#777',
    marginBottom: '10px',
    fontStyle: 'italic'
  }
};

export default TemplateEditor;
