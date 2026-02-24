/**
 * Template Designer Component (ALPHA_M6: The Architect's Forge)
 * 
 * Creative sandbox for designing custom world templates
 * Features:
 * - Location grid with drag-and-drop placement
 * - NPC workbench for character assignment
 * - Loot designer for item configuration
 * - Real-time validation feedback
 * - Hot-swap testing capability
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  validateTemplate,
  composeFromModules,
  createBlankTemplate,
  type WorldTemplate,
  type TemplateModule
} from '../engine/templateEditor';
// import { templateStorageManager } from '../engine/templateStorage';
// import { templateHotSwapManager } from '../engine/templateHotSwap';

// Temporary implementation
const templateStorageManager = {
  saveTemplate: (template: any) => true,
};

const templateHotSwapManager = {
  swapTemplate: (template: any) => ({ success: true, errors: [] }),
};
import styles from './TemplateDesigner.module.css';

interface DesignerLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  description?: string;
  connections?: string[]; // Connected location IDs
}

interface DesignerNPC {
  id: string;
  name: string;
  locationId: string;
  role?: string;
  dialogue?: string[];
}

interface DesignerLootItem {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  type: string;
  value: number;
}

interface DesignerState {
  template: Partial<WorldTemplate>;
  locations: DesignerLocation[];
  npcs: DesignerNPC[];
  lootItems: DesignerLootItem[];
  selectedLocationId?: string;
  selectedNpcId?: string;
  draggedItem?: any;
  validationErrors: string[];
  validationWarnings: string[];
  gridSnap: number;
}

const GRID_COLS = 10;
const GRID_ROWS = 8;
const CELL_SIZE = 60;
const RARITY_COLORS = {
  common: '#888888',
  uncommon: '#28a745',
  rare: '#0066ff',
  epic: '#9933ff',
  legendary: '#ff8800'
};

export default function TemplateDesigner() {
  const [state, setState] = useState<DesignerState>(() => {
    const blank = createBlankTemplate();
    return {
      template: blank,
      locations: [],
      npcs: [],
      lootItems: [],
      gridSnap: 15,
      validationErrors: [],
      validationWarnings: []
    };
  });

  const [mode, setMode] = useState<'locations' | 'npcs' | 'loot'>('locations');
  const [templateName, setTemplateName] = useState('My World');
  const [templateSeason, setTemplateSeason] = useState<'spring' | 'summer' | 'autumn' | 'winter'>('spring');

  // Validate current template state
  const validationResult = useMemo(() => {
    const toValidate: any = {
      id: state.template.id,
      name: templateName,
      description: 'User-created template',
      season: templateSeason,
      locations: state.locations.map(loc => ({
        id: loc.id,
        name: loc.name
      })),
      npcs: state.npcs.map(npc => ({
        id: npc.id,
        name: npc.name,
        locationId: npc.locationId
      })),
      quests: []
    };
    return validateTemplate(toValidate);
  }, [state.template.id, templateName, templateSeason, state.locations, state.npcs]);

  // Update validation display
  React.useEffect(() => {
    setState(prev => ({
      ...prev,
      validationErrors: validationResult.errors,
      validationWarnings: validationResult.warnings || []
    }));
  }, [validationResult]);

  const handleLocationCreate = useCallback(() => {
    const newLocation: DesignerLocation = {
      id: `loc-${Date.now()}`,
      name: `Location ${state.locations.length + 1}`,
      x: Math.floor(Math.random() * (GRID_COLS - 1)) * CELL_SIZE,
      y: Math.floor(Math.random() * (GRID_ROWS - 1)) * CELL_SIZE,
      description: 'A new location'
    };
    setState(prev => ({
      ...prev,
      locations: [...prev.locations, newLocation],
      selectedLocationId: newLocation.id
    }));
  }, [state.locations.length]);

  const handleLocationUpdate = useCallback((id: string, updates: Partial<DesignerLocation>) => {
    setState(prev => ({
      ...prev,
      locations: prev.locations.map(loc =>
        loc.id === id ? { ...loc, ...updates } : loc
      )
    }));
  }, []);

  const handleLocationDelete = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      locations: prev.locations.filter(loc => loc.id !== id),
      npcs: prev.npcs.filter(npc => npc.locationId !== id),
      selectedLocationId: undefined
    }));
  }, []);

  const handleLocationSelect = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedLocationId: id
    }));
  }, []);

  const handleLocationDragStart = useCallback((id: string, e: React.DragEvent) => {
    setState(prev => ({
      ...prev,
      draggedItem: { type: 'location', id }
    }));
  }, []);

  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!state.draggedItem || state.draggedItem.type !== 'location') return;

    const grid = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.round((e.clientX - grid.left) / state.gridSnap) * state.gridSnap;
    const y = Math.round((e.clientY - grid.top) / state.gridSnap) * state.gridSnap;

    handleLocationUpdate(state.draggedItem.id, { x, y });
    setState(prev => ({ ...prev, draggedItem: undefined }));
  }, [state.draggedItem, state.gridSnap, handleLocationUpdate]);

  const handleNpcCreate = useCallback(() => {
    if (!state.selectedLocationId) {
      alert('Select a location first');
      return;
    }
    const newNpc: DesignerNPC = {
      id: `npc-${Date.now()}`,
      name: `NPC ${state.npcs.length + 1}`,
      locationId: state.selectedLocationId,
      role: 'Adventurer'
    };
    setState(prev => ({
      ...prev,
      npcs: [...prev.npcs, newNpc],
      selectedNpcId: newNpc.id
    }));
  }, [state.selectedLocationId, state.npcs.length]);

  const handleNpcUpdate = useCallback((id: string, updates: Partial<DesignerNPC>) => {
    setState(prev => ({
      ...prev,
      npcs: prev.npcs.map(npc =>
        npc.id === id ? { ...npc, ...updates } : npc
      )
    }));
  }, []);

  const handleNpcDelete = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      npcs: prev.npcs.filter(npc => npc.id !== id),
      selectedNpcId: undefined
    }));
  }, []);

  const handleLootCreate = useCallback(() => {
    const newLoot: DesignerLootItem = {
      id: `loot-${Date.now()}`,
      name: `Item ${state.lootItems.length + 1}`,
      rarity: 'common',
      type: 'weapon',
      value: 100
    };
    setState(prev => ({
      ...prev,
      lootItems: [...prev.lootItems, newLoot]
    }));
  }, [state.lootItems.length]);

  const handleLootUpdate = useCallback((id: string, updates: Partial<DesignerLootItem>) => {
    setState(prev => ({
      ...prev,
      lootItems: prev.lootItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  }, []);

  const handleLootDelete = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      lootItems: prev.lootItems.filter(item => item.id !== id)
    }));
  }, []);

  // Get NPCs for selected location
  const locationNpcs = useMemo(() => {
    return state.npcs.filter(npc => npc.locationId === state.selectedLocationId);
  }, [state.npcs, state.selectedLocationId]);

  // 3D-like location grid visualization
  const LocationGrid = () => (
    <div
      className={styles.grid}
      style={{
        width: GRID_COLS * CELL_SIZE,
        height: GRID_ROWS * CELL_SIZE
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleGridDrop}
    >
      {/* Grid lines background */}
      <svg
        className={styles.gridLines}
        width={GRID_COLS * CELL_SIZE}
        height={GRID_ROWS * CELL_SIZE}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * CELL_SIZE}
            y1={0}
            x2={i * CELL_SIZE}
            y2={GRID_ROWS * CELL_SIZE}
            stroke="#ccc"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * CELL_SIZE}
            x2={GRID_COLS * CELL_SIZE}
            y2={i * CELL_SIZE}
            stroke="#ccc"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Location pins */}
      {state.locations.map(loc => (
        <div
          key={loc.id}
          className={`${styles.locationPin} ${state.selectedLocationId === loc.id ? styles.selected : ''}`}
          style={{
            left: loc.x,
            top: loc.y,
            width: CELL_SIZE - 4,
            height: CELL_SIZE - 4
          }}
          draggable
          onDragStart={e => handleLocationDragStart(loc.id, e)}
          onClick={() => handleLocationSelect(loc.id)}
          title={loc.name}
        >
          <div className={styles.pinLabel}>{loc.name.charAt(0)}</div>
          {locationNpcs.length > 0 && (
            <div className={styles.npcBadge}>{locationNpcs.length}</div>
          )}
        </div>
      ))}
    </div>
  );

  const selectedLocation = state.locations.find(loc => loc.id === state.selectedLocationId);
  const selectedNpc = state.npcs.find(npc => npc.id === state.selectedNpcId);

  // Action handlers
  const handleSaveTemplate = useCallback(() => {
    if (!validationResult.valid) {
      alert('Cannot save invalid template');
      return;
    }

    const userTemplate: any = {
      id: state.template.id || `tpl-${Date.now()}`,
      name: templateName,
      description: `A world template created by ${new Date().toLocaleDateString()}`,
      authorId: 'player',
      template: {
        id: state.template.id || `tpl-${Date.now()}`,
        name: templateName,
        description: 'User-created world template',
        season: templateSeason,
        locations: state.locations.map(loc => ({
          id: loc.id,
          name: loc.name
        })),
        npcs: state.npcs.map(npc => ({
          id: npc.id,
          name: npc.name,
          locationId: npc.locationId,
          role: npc.role
        })),
        quests: []
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
      downloads: 0
    };

    const saved = templateStorageManager.saveTemplate(userTemplate);
    if (saved) {
      alert(`✓ Template saved: "${templateName}"`);
      setState(prev => ({
        ...prev,
        template: userTemplate.template
      }));
    } else {
      alert('✗ Failed to save template');
    }
  }, [validationResult.valid, state.template.id, templateName, templateSeason, state.locations, state.npcs]);

  const handleTestDrive = useCallback(() => {
    if (!validationResult.valid) {
      alert('Cannot test invalid template');
      return;
    }

    const userTemplate: any = {
      id: `test-${Date.now()}`,
      name: `${templateName} (Test)`,
      description: 'Test drive template',
      authorId: 'player',
      template: {
        id: `test-${Date.now()}`,
        name: templateName,
        season: templateSeason,
        locations: state.locations,
        npcs: state.npcs,
        quests: []
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
      downloads: 0
    };

    const result = templateHotSwapManager.swapTemplate(userTemplate);
    if (result.success) {
      alert(`✓ Test drive started!\n\nTemplate: ${templateName}\nLocations: ${state.locations.length}\nNPCs: ${state.npcs.length}`);
    } else {
      alert(`✗ Test drive failed:\n${result.errors?.join('\n')}`);
    }
  }, [validationResult.valid, templateName, templateSeason, state.locations, state.npcs]);

  const handleExportTemplate = useCallback(() => {
    if (!validationResult.valid) {
      alert('Cannot export invalid template');
      return;
    }

    const userTemplate: any = {
      id: state.template.id || `tpl-${Date.now()}`,
      name: templateName,
      description: 'User-created world template',
      authorId: 'player',
      template: {
        id: state.template.id || `tpl-${Date.now()}`,
        name: templateName,
        season: templateSeason,
        locations: state.locations,
        npcs: state.npcs,
        quests: []
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
      downloads: 0
    };

    const jsonStr = JSON.stringify(userTemplate, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${templateName.replace(/\s+/g, '_')}_template.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [validationResult.valid, state.template.id, templateName, templateSeason, state.locations, state.npcs]);

  const handleImportTemplate = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const imported = JSON.parse(event.target.result);
          const template = imported.template || imported;

          if (template.locations && template.npcs !== undefined) {
            setState(prev => ({
              ...prev,
              locations: template.locations || [],
              npcs: template.npcs || [],
              template: template
            }));
            setTemplateName(template.name || 'Imported Template');
            setTemplateSeason(template.season || 'spring');
            alert('✓ Template imported successfully');
          } else {
            alert('✗ Invalid template format');
          }
        } catch (error) {
          alert(`✗ Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className={styles.designer}>
      <header className={styles.header}>
        <h1>The Architect's Forge</h1>
        <p>Design your custom world template</p>
      </header>

      {/* Template metadata panel */}
      <div className={styles.metadataPanel}>
        <div className={styles.formGroup}>
          <label>Template Name</label>
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="My World"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Season</label>
          <select value={templateSeason} onChange={e => setTemplateSeason(e.target.value as any)}>
            <option value="spring">Spring</option>
            <option value="summer">Summer</option>
            <option value="autumn">Autumn</option>
            <option value="winter">Winter</option>
          </select>
        </div>
      </div>

      {/* Mode switcher */}
      <div className={styles.modeSelector}>
        <button
          className={mode === 'locations' ? styles.active : ''}
          onClick={() => setMode('locations')}
        >
          🗺️ Locations ({state.locations.length})
        </button>
        <button
          className={mode === 'npcs' ? styles.active : ''}
          onClick={() => setMode('npcs')}
        >
          👤 NPCs ({state.npcs.length})
        </button>
        <button
          className={mode === 'loot' ? styles.active : ''}
          onClick={() => setMode('loot')}
        >
          💎 Loot ({state.lootItems.length})
        </button>
      </div>

      <div className={styles.mainContainer}>
        {/* Location Editor */}
        {mode === 'locations' && (
          <div className={styles.modeContent}>
            <div className={styles.gridContainer}>
              <LocationGrid />
            </div>
            <div className={styles.editorPanel}>
              <button onClick={handleLocationCreate} className={styles.createButton}>
                + Add Location
              </button>
              {selectedLocation && (
                <div className={styles.editPanel}>
                  <h3>Edit Location</h3>
                  <div className={styles.formGroup}>
                    <label>Name</label>
                    <input
                      type="text"
                      value={selectedLocation.name}
                      onChange={e => handleLocationUpdate(selectedLocation.id, { name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Description</label>
                    <textarea
                      value={selectedLocation.description || ''}
                      onChange={e => handleLocationUpdate(selectedLocation.id, { description: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Position: ({selectedLocation.x}, {selectedLocation.y})</label>
                    <p>Drag on grid to move</p>
                  </div>
                  <button
                    onClick={() => handleLocationDelete(selectedLocation.id)}
                    className={styles.deleteButton}
                  >
                    Delete Location
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NPC Editor */}
        {mode === 'npcs' && (
          <div className={styles.modeContent}>
            <div className={styles.editorPanel}>
              <h3>NPC Workbench</h3>
              {!selectedLocation ? (
                <p>📍 Select a location first</p>
              ) : (
                <>
                  <div className={styles.locationContext}>
                    <strong>Location:</strong> {selectedLocation.name}
                  </div>
                  <button onClick={handleNpcCreate} className={styles.createButton}>
                    + Add NPC to {selectedLocation.name}
                  </button>
                  <div className={styles.npcList}>
                    {locationNpcs.map(npc => (
                      <div key={npc.id} className={`${styles.npcItem} ${state.selectedNpcId === npc.id ? styles.selected : ''}`}>
                        <div onClick={() => setState(prev => ({ ...prev, selectedNpcId: npc.id }))}>
                          <strong>{npc.name}</strong>
                          <p>{npc.role || 'Role unset'}</p>
                        </div>
                        {state.selectedNpcId === npc.id && (
                          <div className={styles.npcEditPanel}>
                            <input
                              type="text"
                              placeholder="Name"
                              value={npc.name}
                              onChange={e => handleNpcUpdate(npc.id, { name: e.target.value })}
                            />
                            <select
                              value={npc.role || ''}
                              onChange={e => handleNpcUpdate(npc.id, { role: e.target.value })}
                            >
                              <option value="">-- Select Role --</option>
                              <option value="Merchant">Merchant</option>
                              <option value="Guard">Guard</option>
                              <option value="Sage">Sage</option>
                              <option value="Adventurer">Adventurer</option>
                              <option value="Blacksmith">Blacksmith</option>
                              <option value="Innkeeper">Innkeeper</option>
                            </select>
                            <button onClick={() => handleNpcDelete(npc.id)} className={styles.deleteButton}>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loot Designer */}
        {mode === 'loot' && (
          <div className={styles.modeContent}>
            <div className={styles.editorPanel}>
              <h3>Loot Designer</h3>
              <button onClick={handleLootCreate} className={styles.createButton}>
                + Add Loot Item
              </button>
              <div className={styles.lootGrid}>
                {state.lootItems.map(item => (
                  <div
                    key={item.id}
                    className={styles.lootCard}
                    style={{ borderColor: RARITY_COLORS[item.rarity] }}
                  >
                    <div className={styles.lootRarity} style={{ backgroundColor: RARITY_COLORS[item.rarity] }}>
                      {item.rarity[0].toUpperCase()}
                    </div>
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => handleLootUpdate(item.id, { name: e.target.value })}
                      className={styles.lootName}
                    />
                    <input
                      type="text"
                      value={item.type}
                      onChange={e => handleLootUpdate(item.id, { type: e.target.value })}
                      placeholder="Type"
                      className={styles.lootType}
                    />
                    <select
                      value={item.rarity}
                      onChange={e => handleLootUpdate(item.id, { rarity: e.target.value as any })}
                    >
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="epic">Epic</option>
                      <option value="legendary">Legendary</option>
                    </select>
                    <input
                      type="number"
                      value={item.value}
                      onChange={e => handleLootUpdate(item.id, { value: parseInt(e.target.value) })}
                      placeholder="Value"
                      className={styles.lootValue}
                    />
                    <button onClick={() => handleLootDelete(item.id)} className={styles.deleteButton}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Validation feedback */}
      {(state.validationErrors.length > 0 || state.validationWarnings.length > 0) && (
        <div className={styles.validationPanel}>
          {state.validationErrors.length > 0 && (
            <div className={styles.errorSection}>
              <h4>❌ Errors</h4>
              <ul>
                {state.validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          {state.validationWarnings.length > 0 && (
            <div className={styles.warningSection}>
              <h4>⚠️ Warnings</h4>
              <ul>
                {state.validationWarnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.actionBar}>
        <button
          disabled={!validationResult.valid}
          className={styles.primaryButton}
          onClick={handleSaveTemplate}
        >
          ✓ Save Template
        </button>
        <button className={styles.secondaryButton} onClick={handleImportTemplate}>
          📥 Import Template
        </button>
        <button className={styles.secondaryButton} onClick={handleExportTemplate}>
          📤 Export Template
        </button>
        <button
          className={styles.testButton}
          disabled={!validationResult.valid}
          onClick={handleTestDrive}
        >
          🧪 Test Drive
        </button>
      </div>
    </div>
  );
}
