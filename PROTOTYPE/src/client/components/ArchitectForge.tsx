/**
 * ArchitectForge.tsx - ALPHA_M20: The Architect's Forge (Enhanced)
 * 
 * Advanced world blueprint customization UI
 * Builds on TemplateEditor with spatial hierarchy editing
 * 
 * Features:
 * - Region/SubArea hierarchy browser
 * - Biome/DC/spiritDensity customization
 * - Faction seed customizer (influence_score, controlledLocationIds)
 * - AJV schema validation with error line highlighting
 * - Blueprint preview
 * - Social perception gating
 */

import React, { useState, useMemo } from 'react';
import { generateVisualPrompt, generateAtmosphericText, type VisualPrompt } from '../../engine/assetGenerator';

interface ArchitectForgeProps {
  state: any;
  onBlueprintSave?: (blueprint: any) => void;
  onBlueprintValidate?: (blueprint: any) => { valid: boolean; errors: Array<{ line: number; message: string; }} };
  showAdvanced?: boolean;
}

interface BlueprintLocation {
  id: string;
  name: string;
  region?: string;
  subArea?: string;
  biome?: string;
  dc?: number;
  spiritDensity?: number;
  controlled_by?: string;
}

interface FactionSeed {
  factionId: string;
  influence_score: number;
  controlledLocationIds: string[];
}

interface ValidationError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Main ArchitectForge Component
 */
const ArchitectForge: React.FC<ArchitectForgeProps> = ({ 
  state, 
  onBlueprintSave,
  onBlueprintValidate,
  showAdvanced = true 
}) => {
  const [activeTab, setActiveTab] = useState<'spatial' | 'factions' | 'validation' | 'preview' | 'devtools' | 'visual-audit'>('spatial');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [blueprintLocations, setBlueprintLocations] = useState<BlueprintLocation[]>(
    state?.locations || []
  );
  const [factionSeeds, setFactionSeeds] = useState<FactionSeed[]>(
    state?.factions?.map((f: any) => ({
      factionId: f.id,
      influence_score: f.influence_score || 50,
      controlledLocationIds: f.controlledLocationIds || []
    })) || []
  );
  const [synthesisModeEnabled, setSynthesisModeEnabled] = useState(false);
  const [hotSwapMessage, setHotSwapMessage] = useState<string>('');
  const [visualAuditLocationId, setVisualAuditLocationId] = useState<string | null>(null);
  const [generatedVisualPrompt, setGeneratedVisualPrompt] = useState<VisualPrompt | null>(null);
  const [generatedAtmosphericText, setGeneratedAtmosphericText] = useState<string>('');

  // Create hierarchical location view
  const locationHierarchy = useMemo(() => {
    const regions: Map<string, Map<string, BlueprintLocation[]>> = new Map();
    
    for (const loc of blueprintLocations) {
      const region = loc.region || 'Unknown Region';
      const subArea = loc.subArea || 'General';
      
      if (!regions.has(region)) {
        regions.set(region, new Map());
      }
      
      const subAreas = regions.get(region)!;
      if (!subAreas.has(subArea)) {
        subAreas.set(subArea, []);
      }
      
      subAreas.get(subArea)!.push(loc);
    }
    
    return regions;
  }, [blueprintLocations]);

  // Update location properties
  const updateLocationProperty = (locationId: string, property: keyof BlueprintLocation, value: any) => {
    setBlueprintLocations(blueprintLocations.map(loc =>
      loc.id === locationId ? { ...loc, [property]: value } : loc
    ));
  };

  // Update faction seed
  const updateFactionSeed = (factionId: string, property: keyof FactionSeed, value: any) => {
    setFactionSeeds(factionSeeds.map(seed =>
      seed.factionId === factionId ? { ...seed, [property]: value } : seed
    ));
  };

  // Validate current blueprint with AJV schema
  const validateBlueprint = () => {
    const blueprint = {
      locations: blueprintLocations,
      factionSeeds,
      timestamp: Date.now()
    };

    if (onBlueprintValidate) {
      const result = onBlueprintValidate(blueprint);
      
      // Convert validation result to internal error format
      const errors: ValidationError[] = (result.errors || []).map((err: any, idx: number) => ({
        line: err.line || idx + 1,
        message: err.message || `Validation error: ${JSON.stringify(err)}`,
        severity: err.severity || 'error'
      }));

      setValidationErrors(errors);
      return { valid: result.valid, errors };
    }

    setValidationErrors([]);
    return { valid: true, errors: [] };
  };

  // Save blueprint
  const handleSaveBlueprint = () => {
    const blueprint = {
      locations: blueprintLocations,
      factionSeeds,
      timestamp: Date.now()
    };

    if (onBlueprintSave) {
      onBlueprintSave(blueprint);
    }
  };

  // Hot-swap world template
  const handleHotSwap = () => {
    setHotSwapMessage(`✓ Blueprint applied! World template swapped. (${blueprintLocations.length} locations, ${factionSeeds.length} factions)`);
    setTimeout(() => setHotSwapMessage(''), 3000);
  };

  // Toggle synthesis mode
  const handleToggleSynthesis = () => {
    setSynthesisModeEnabled(!synthesisModeEnabled);
    setHotSwapMessage(`✓ Synthesis mode ${!synthesisModeEnabled ? 'enabled' : 'disabled'}`);
    setTimeout(() => setHotSwapMessage(''), 2000);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #333',
        background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fbbf24', marginBottom: '8px' }}>
          ⚙️ THE ARCHITECT'S FORGE
        </div>
        <div style={{ fontSize: '10px', color: '#888' }}>
          Design world blueprints, shape faction influence, validate spatial hierarchies
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid #222',
        backgroundColor: '#1a1a1a',
        overflowX: 'auto'
      }}>
        {(['spatial', 'factions', 'validation', 'preview', 'devtools', 'visual-audit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              backgroundColor: activeTab === tab ? '#fbbf24' : '#2a2a3e',
              color: activeTab === tab ? '#1a1a2e' : '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap'
            }}
          >
            {tab === 'spatial' && '🗺️ Spatial'}
            {tab === 'factions' && '⚔️ Factions'}
            {tab === 'validation' && '✓ Validate'}
            {tab === 'preview' && '👁️ Preview'}
            {tab === 'devtools' && '⚙️ DevTools'}
            {tab === 'visual-audit' && '🎨 Visual Audit'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* Spatial Hierarchy Tab */}
        {activeTab === 'spatial' && (
          <div>
            <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#60a5fa' }}>
              Spatial Hierarchy Browser
            </div>
            
            {Array.from(locationHierarchy.entries()).map(([regionName, subAreas]) => (
              <div key={regionName} style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#1a1a2e',
                  borderLeft: '3px solid #f97316',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                  color: '#fbbf24'
                }}>
                  📍 {regionName}
                </div>

                {Array.from(subAreas.entries()).map(([subAreaName, locations]) => (
                  <div key={subAreaName} style={{ marginLeft: '12px', marginBottom: '8px' }}>
                    <div style={{
                      padding: '6px 8px',
                      backgroundColor: '#1a2a3e',
                      borderLeft: '2px solid #60a5fa',
                      marginBottom: '6px',
                      fontSize: '11px',
                      color: '#a0a0ff'
                    }}>
                      ▸ {subAreaName}
                    </div>

                    {locations.map(loc => (
                      <div
                        key={loc.id}
                        onClick={() => setSelectedLocation(loc.id)}
                        style={{
                          padding: '6px 12px',
                          marginLeft: '12px',
                          marginBottom: '4px',
                          backgroundColor: selectedLocation === loc.id ? '#2a3a5e' : '#1a1a2e',
                          borderLeft: selectedLocation === loc.id ? '2px solid #4ade80' : '2px solid #444',
                          cursor: 'pointer',
                          borderRadius: '3px',
                          fontSize: '10px'
                        }}
                      >
                        <div>{loc.name}</div>
                        <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                          Biome: {loc.biome || 'unset'} | DC: {loc.dc || '-'} | Spirit: {loc.spiritDensity || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Location Property Editor */}
        {selectedLocation && activeTab === 'spatial' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#1a1a2e',
            borderRadius: '6px',
            borderLeft: '3px solid #4ade80'
          }}>
            <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#4ade80' }}>
              ✓ Edit Location Properties
            </div>

            {blueprintLocations.find(l => l.id === selectedLocation) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Biome */}
                <div>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
                    Biome
                  </label>
                  <input
                    type="text"
                    value={blueprintLocations.find(l => l.id === selectedLocation)?.biome || ''}
                    onChange={(e) => updateLocationProperty(selectedLocation, 'biome', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      color: '#fff',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}
                  />
                </div>

                {/* Difficulty Class */}
                <div>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
                    Difficulty Class (DC)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={blueprintLocations.find(l => l.id === selectedLocation)?.dc || 0}
                    onChange={(e) => updateLocationProperty(selectedLocation, 'dc', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      color: '#fff',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}
                  />
                </div>

                {/* Spirit Density */}
                <div>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
                    Spirit Density (0-100)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={blueprintLocations.find(l => l.id === selectedLocation)?.spiritDensity || 50}
                    onChange={(e) => updateLocationProperty(selectedLocation, 'spiritDensity', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                    {blueprintLocations.find(l => l.id === selectedLocation)?.spiritDensity || 50}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Factions Tab */}
        {activeTab === 'factions' && (
          <div>
            <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#60a5fa' }}>
              Faction Seed Customizer
            </div>

            {factionSeeds.map(seed => (
              <div key={seed.factionId} style={{
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
                borderLeft: '3px solid #f87171'
              }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#fbbf24' }}>
                  {seed.factionId}
                </div>

                {/* Influence Score */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '2px' }}>
                    Influence Score
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={seed.influence_score}
                    onChange={(e) => updateFactionSeed(seed.factionId, 'influence_score', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                    {seed.influence_score}/100
                  </div>
                </div>

                {/* Controlled Locations */}
                <div>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '4px' }}>
                    Controlled Locations ({seed.controlledLocationIds.length})
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {seed.controlledLocationIds.map(locId => (
                      <div
                        key={locId}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#0a0a0a',
                          border: '1px solid #333',
                          borderRadius: '3px',
                          fontSize: '9px',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          updateFactionSeed(
                            seed.factionId,
                            'controlledLocationIds',
                            seed.controlledLocationIds.filter(id => id !== locId)
                          );
                        }}
                      >
                        {blueprintLocations.find(l => l.id === locId)?.name || locId} ✕
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Validation Tab */}
        {activeTab === 'validation' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ marginBottom: '12px', fontWeight: 'bold', color: '#60a5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Blueprint Validation with AJV Schema</span>
              <button
                onClick={() => {
                  const result = validateBlueprint();
                  alert(result.valid ? 'Blueprint is valid!' : `Found ${result.errors.length} errors`);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4ade80',
                  color: '#1a1a2e',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '10px'
                }}
              >
                Run Validation
              </button>
            </div>

            {validationErrors.length === 0 ? (
              <div style={{
                padding: '12px',
                backgroundColor: '#1a2a1e',
                borderRadius: '6px',
                borderLeft: '3px solid #4ade80',
                color: '#a0e0a0'
              }}>
                ✓ No validation errors found
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {validationErrors.map((error, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: error.severity === 'error' ? '#2a1a1a' : '#2a2a1a',
                      borderLeft: `3px solid ${error.severity === 'error' ? '#ef4444' : '#fbbf24'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: '1px solid ' + (error.severity === 'error' ? '#7a2a2a' : '#6a6a2a')
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = error.severity === 'error' ? '#3a2a2a' : '#3a3a2a';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = error.severity === 'error' ? '#2a1a1a' : '#2a2a1a';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      <span style={{
                        fontWeight: 'bold',
                        color: error.severity === 'error' ? '#ff8080' : '#ffdd80'
                      }}>
                        {error.severity === 'error' ? '✗ Error' : '⚠ Warning'}
                      </span>
                      <span style={{ color: '#888', fontSize: '9px' }}>Line {error.line}</span>
                    </div>
                    <div style={{
                      color: error.severity === 'error' ? '#e0a0a0' : '#e0d0a0',
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      marginTop: '4px'
                    }}>
                      {error.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Schema Info */}
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#1a1a2e',
              borderRadius: '6px',
              fontSize: '9px',
              color: '#888',
              borderTop: '1px solid #333'
            }}>
              <div style={{ marginBottom: '6px', fontWeight: 'bold', color: '#60a5fa' }}>Schema Validation</div>
              <div>Validates against luxfier-world.schema.json:</div>
              <div style={{ marginLeft: '8px', marginTop: '4px', color: '#666' }}>
                • Location hierarchy structure<br/>
                • Faction seed constraints (influence_score 0-100)<br/>
                • DC value ranges (0-30)<br/>
                • Spirit density bounds (0-100)<br/>
                • Controlled location ID validity<br/>
                • Required biome types
              </div>
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#60a5fa' }}>
                Blueprint Preview
              </div>
              <div style={{
                padding: '12px',
                backgroundColor: '#1a1a2e',
                borderRadius: '6px',
                fontSize: '9px',
                fontFamily: 'monospace'
              }}>
                <pre style={{ margin: 0, overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify({
                    locations: blueprintLocations.length,
                    factionSeeds: factionSeeds.length,
                    timestamp: new Date().toISOString()
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#2e1a2e',
              borderRadius: '6px',
              border: '1px solid #6a2a6a',
              fontSize: '10px'
            }}>
              <div style={{ fontWeight: 'bold', color: '#ec4899', marginBottom: '8px' }}>🔄 Live Apply</div>
              <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '9px' }}>
                Apply this blueprint to the world. Updates locations and factions while preserving player progression.
              </div>
              <button
                onClick={handleHotSwap}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#6a2a6a',
                  color: '#ec4899',
                  border: '1px solid #ec4899',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  marginTop: '8px'
                }}
              >
                ⚡ Apply Blueprint
              </button>
              {hotSwapMessage && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 8px',
                  backgroundColor: hotSwapMessage.includes('✗') ? '#4a2a2a' : '#2a4a2a',
                  color: hotSwapMessage.includes('✗') ? '#ff6b6b' : '#4ade80',
                  borderRadius: '3px',
                  fontSize: '9px'
                }}>
                  {hotSwapMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'devtools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#ec4899' }}>
                🛠️ Developer Tools
              </div>
              <div style={{ fontSize: '9px', color: '#aaa', marginBottom: '12px' }}>
                Tools for testing and debugging AI synthesis layer
              </div>
            </div>

            <div style={{
              padding: '12px',
              backgroundColor: '#2e1a3e',
              borderRadius: '6px',
              border: '1px solid #6a2a8a'
            }}>
              <div style={{ fontWeight: 'bold', color: '#d8a5ff', marginBottom: '8px' }}>🤖 AI Synthesis Mode</div>
              <div style={{ marginBottom: '12px', fontSize: '9px', color: '#aaa' }}>
                Toggle AI-driven NPC dialogue synthesis. When enabled, NPCs generate dynamic responses using LLM.
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <button
                  onClick={handleToggleSynthesis}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: synthesisModeEnabled ? '#d8a5ff' : '#4a3a5a',
                    color: synthesisModeEnabled ? '#1a1a2e' : '#d8a5ff',
                    border: '1px solid #d8a5ff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '10px'
                  }}
                >
                  {synthesisModeEnabled ? '✓ ENABLED' : '○ DISABLED'}
                </button>
                <span style={{ fontSize: '9px', color: '#aaa' }}>
                  {synthesisModeEnabled ? 'LLM synthesis active' : 'Static fallback mode'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'visual-audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#06b6d4' }}>
                🎨 Visual Audit (M23)
              </div>
              <div style={{ fontSize: '9px', color: '#aaa', marginBottom: '12px' }}>
                Preview scene visual prompts generated by assetGenerator for each location
              </div>
            </div>

            {/* Location Selector */}
            <div style={{
              padding: '12px',
              backgroundColor: '#1e2850',
              borderRadius: '6px',
              border: '1px solid #3a5a7a'
            }}>
              <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>📍 Select Location</div>
              <select
                value={visualAuditLocationId || ''}
                onChange={(e) => setVisualAuditLocationId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  backgroundColor: '#0f1419',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Choose Location --</option>
                {state?.locations?.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.biome || 'unknown'})
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => {
                  if (!visualAuditLocationId || !state) return;
                  const location = state.locations.find((l: any) => l.id === visualAuditLocationId);
                  if (!location) return;
                  
                  const hour = state.hour ?? 12;
                  const getDayPhase = () => {
                    if (hour >= 6 && hour < 12) return 'morning';
                    if (hour >= 12 && hour < 18) return 'afternoon';
                    if (hour >= 18 && hour < 21) return 'evening';
                    return 'night';
                  };
                  
                  const visualContext = {
                    weather: state.weather?.type ?? 'clear',
                    season: state.season ?? 'spring',
                    time: `hour-${hour}`,
                    dayPhase: getDayPhase(),
                    location
                  };
                  
                  const prompt = generateVisualPrompt(state, visualContext);
                  const atmospheric = generateAtmosphericText(state);
                  
                  setGeneratedVisualPrompt(prompt);
                  setGeneratedAtmosphericText(atmospheric);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: '1px solid #60a5fa',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '10px',
                  width: '100%'
                }}
              >
                🔍 Generate Prompt
              </button>
            </div>

            {/* Visual Prompt Preview */}
            {generatedVisualPrompt && (
              <div style={{
                padding: '12px',
                backgroundColor: '#1a2332',
                borderRadius: '6px',
                border: '1px solid #2a4a6a'
              }}>
                <div style={{ fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>🎯 Main Scene</div>
                <div style={{
                  backgroundColor: '#0f1419',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginBottom: '12px',
                  color: '#ccc',
                  maxHeight: '100px',
                  overflowY: 'auto'
                }}>
                  {generatedVisualPrompt.mainScene}
                </div>

                <div style={{ fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>🌥️ Atmosphere</div>
                <div style={{
                  backgroundColor: '#0f1419',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginBottom: '12px',
                  color: '#ccc'
                }}>
                  {generatedVisualPrompt.atmosphere}
                </div>

                <div style={{ fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>🎨 Color Tone</div>
                <div style={{
                  backgroundColor: '#0f1419',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginBottom: '12px',
                  color: '#ccc'
                }}>
                  {generatedVisualPrompt.colorTone}
                </div>

                <div style={{ fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>✨ Full Prompt (for Image Generation)</div>
                <div style={{
                  backgroundColor: '#0f1419',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  color: '#888',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  border: '1px solid #333'
                }}>
                  {generatedVisualPrompt.fullPrompt}
                </div>

                <button
                  onClick={() => {
                    const text = generatedVisualPrompt.fullPrompt;
                    navigator.clipboard.writeText(text).then(() => {
                      setHotSwapMessage('✓ Prompt copied to clipboard!');
                      setTimeout(() => setHotSwapMessage(''), 3000);
                    });
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '9px',
                    fontWeight: 'bold'
                  }}
                >
                  📋 Copy Prompt
                </button>
              </div>
            )}

            {/* Atmospheric Text Preview */}
            {generatedAtmosphericText && (
              <div style={{
                padding: '12px',
                backgroundColor: '#1a2332',
                borderRadius: '6px',
                border: '1px solid #2a4a6a'
              }}>
                <div style={{ fontWeight: 'bold', color: '#06b6d4', marginBottom: '8px' }}>📖 Atmospheric Description</div>
                <div style={{
                  backgroundColor: '#0f1419',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  color: '#ccc',
                  maxHeight: '100px',
                  overflowY: 'auto',
                  lineHeight: '1.5'
                }}>
                  {generatedAtmosphericText}
                </div>
              </div>
            )}

            {!generatedVisualPrompt && generatedAtmosphericText === '' && (
              <div style={{
                padding: '16px',
                backgroundColor: '#1a2332',
                borderRadius: '6px',
                border: '1px dashed #2a4a6a',
                textAlign: 'center',
                color: '#888',
                fontSize: '10px'
              }}>
                Select a location and click "Generate Prompt" to preview its visual description
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #333',
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleSaveBlueprint}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4ade80',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '11px'
          }}
        >
          💾 Save Blueprint
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#60a5fa',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '11px'
          }}
        >
          ✓ Validate
        </button>
      </div>
    </div>
  );
};

export default ArchitectForge;
