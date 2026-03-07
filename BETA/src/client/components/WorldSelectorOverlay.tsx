/**
 * Phase 30 Task 4: World Selection UI Scaffold
 * Phase 33 Extension: Visual Lens (Narrative Codec) Selection
 * 
 * Provides a UI for players to select between available world templates
 * and choose the narrative codec/visual lens that frames their experience.
 * 
 * Features:
 * - Lists all registered templates with metadata (difficulty, genre, description)
 * - Displays template difficulty with visual indicators
 * - Visual Lens dropdown to select narrative codec
 * - Auto-suggests recommended codec per world template
 * - Triggers callbacks when template/codec are selected
 * - Accessibility: full keyboard navigation, ARIA labels
 */

import React from 'react';
import type { WorldTemplateMetadata } from '../../engine/worldRegistry';
import { themeManager } from '../services/themeManager';
import type { NarrativeCodec } from '../services/themeManager';

interface WorldSelectorOverlayProps {
  templates: WorldTemplateMetadata[];
  onSelectTemplate: (templateId: string) => void;
  isOpen?: boolean;
}

export default function WorldSelectorOverlay({
  templates,
  onSelectTemplate,
  isOpen = false
}: WorldSelectorOverlayProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(
    templates.length > 0 ? templates[0].id : null
  );
  const [selectedCodec, setSelectedCodec] = React.useState<NarrativeCodec>(
    themeManager.getCodec()
  );
  const [availableCodecs, setAvailableCodecs] = React.useState<NarrativeCodec[]>([]);

  // Load available codecs on mount
  React.useEffect(() => {
    const codecs = themeManager.getAllCodecs();
    setAvailableCodecs(codecs);
    
    // Set initial codec based on selected template's preference
    if (selectedId) {
      const template = templates.find(t => t.id === selectedId);
      if (template?.preferredThemeId) {
        setSelectedCodec(template.preferredThemeId);
        themeManager.setCodec(template.preferredThemeId);
      }
    }
  }, [selectedId, templates]);

  const handleCodecChange = (codec: NarrativeCodec) => {
    setSelectedCodec(codec);
    themeManager.setCodec(codec);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedId(templateId);
    // Auto-switch to template's preferred codec
    const template = templates.find(t => t.id === templateId);
    if (template?.preferredThemeId) {
      handleCodecChange(template.preferredThemeId);
    }
  };

  const handleConfirm = () => {
    if (selectedId) {
      onSelectTemplate(selectedId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981'; // emerald
      case 'intermediate':
        return '#f59e0b'; // amber
      case 'expert':
        return '#ef4444'; // red
      default:
        return '#8b5cf6'; // purple
    }
  };

  const getDifficultyLabel = (difficulty: string): string => {
    switch (difficulty) {
      case 'beginner':
        return '🟢 Beginner';
      case 'intermediate':
        return '🟡 Intermediate';
      case 'expert':
        return '🔴 Expert';
      default:
        return '⚫ Unknown';
    }
  };

  const getCodecLabel = (codec: NarrativeCodec): string => {
    const def = themeManager.getCodecDefinition(codec);
    return def.label;
  };

  const getCodecDescription = (codec: NarrativeCodec): string => {
    const def = themeManager.getCodecDefinition(codec);
    return def.description;
  };

  const getRecommendedCodecForTemplate = (templateId: string): string => {
    const template = templates.find(t => t.id === templateId);
    if (template?.preferredThemeId) {
      return getCodecLabel(template.preferredThemeId);
    }
    return 'Default';
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="World Template & Narrative Codec Selector"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'monospace'
      }}
    >
      <div
        style={{
          backgroundColor: '#1a1a2e',
          border: '2px solid #c084fc',
          borderRadius: '8px',
          padding: '32px',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 0 40px rgba(192, 132, 252, 0.3)'
        }}
      >
        <h2 style={{ color: '#c084fc', marginTop: 0 }}>
          🌍 Select World & Narrative Lens
        </h2>

        <p style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '24px' }}>
          Choose a world template and the visual lens through which you'll experience your adventure.
        </p>

        {/* VISUAL LENS DROPDOWN */}
        <div style={{ marginBottom: '28px' }}>
          <label
            htmlFor="visual-lens-select"
            style={{
              display: 'block',
              color: '#d4af92',
              fontWeight: 'bold',
              fontSize: '12px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}
          >
            ✨ Visual Lens (Narrative Codec)
          </label>
          <select
            id="visual-lens-select"
            value={selectedCodec}
            onChange={(e) => handleCodecChange(e.target.value as NarrativeCodec)}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: 'rgba(92, 64, 51, 0.3)',
              border: '2px solid #8b5cf6',
              borderRadius: '4px',
              color: '#e8d7c3',
              fontFamily: 'monospace',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {availableCodecs.map((codec) => (
              <option key={codec} value={codec}>
                {getCodecLabel(codec)} — {getCodecDescription(codec)}
              </option>
            ))}
          </select>
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'rgba(79, 39, 131, 0.2)',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#a0aec0'
            }}
          >
            💡 Recommended for {templates.find(t => t.id === selectedId)?.name || 'this world'}: <strong>{getRecommendedCodecForTemplate(selectedId || '')}</strong>
          </div>
        </div>

        {/* Template List */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: '#d4af92', fontSize: '14px', marginTop: '20px', marginBottom: '12px' }}>
            📖 World Template
          </h3>
          {templates.map((template) => (
            <label
              key={template.id}
              style={{
                display: 'block',
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: selectedId === template.id ? 'rgba(192, 132, 252, 0.1)' : 'rgba(79, 39, 131, 0.1)',
                border: `2px solid ${selectedId === template.id ? '#c084fc' : '#4f2783'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="radio"
                  name="template"
                  value={template.id}
                  checked={selectedId === template.id}
                  onChange={() => handleTemplateChange(template.id)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  aria-label={`Select ${template.name}`}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '4px' }}>
                    {template.name}
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '12px', marginBottom: '4px' }}>
                    {template.description}
                  </div>
                  <div style={{ fontSize: '11px' }}>
                    <span style={{ color: getDifficultyColor(template.difficulty), marginRight: '12px' }}>
                      {getDifficultyLabel(template.difficulty)}
                    </span>
                    <span style={{ color: '#8b5cf6' }}>
                      {template.genre}
                    </span>
                    {template.preferredThemeId && (
                      <span style={{ color: '#c084fc', marginLeft: '12px' }}>
                        🎭 Lens: {getCodecLabel(template.preferredThemeId)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 24px',
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = '#a78bfa';
            }}
            onMouseLeave={(e) => {
              const target = e.target as HTMLButtonElement;
              target.style.backgroundColor = '#8b5cf6';
            }}
            onKeyDown={handleKeyDown}
          >
            ✓ Enter World
          </button>
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(79, 39, 131, 0.2)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#a0aec0'
          }}
        >
          💡 <strong>Tip:</strong> Each world has a recommended visual lens. You can override it anytime to customize your experience!
        </div>
      </div>
    </div>
  );
}
